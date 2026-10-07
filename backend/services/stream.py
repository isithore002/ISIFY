"""Live streaming: resolve a track to a direct audio URL so playback can start immediately,
without waiting for the slower download → MP3 conversion → tagging pipeline.

The resolved URL is kept in memory (they expire, and are tied to this machine's IP), and the
audio is proxied through the backend so the browser never talks to YouTube itself.
"""
import re
import json
import time
import asyncio
import logging
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qs
import httpx
import yt_dlp
from models.track import PrepareRequest
from services.youtube import CACHE_DIR, _base_opts, _pick_video, _clean_error, shared_ydl

log = logging.getLogger(__name__)

URL_SAFETY_S = 120        # treat a URL as expired this long before it really is
DEFAULT_TTL_S = 1800
MAX_ENTRIES = 150         # each warmed entry may also hold HEAD_BYTES of audio in memory
CONCURRENT_WARMS = 2      # background look-ups (hover, next song) are throttled...
# ...but a song someone just clicked never waits in that line. Downloading the MP3 in the
# background also competes with the live stream (measured: time-to-first-audio doubled), so it
# starts only once the listener has clearly settled into the song.
CACHE_DELAY_S = 30

HEAD_BYTES = 160 * 1024     # ~10s of AAC: enough to bridge the wait for the first upstream bytes

_MIME = {"m4a": "audio/mp4", "mp4": "audio/mp4", "webm": "audio/webm", "opus": "audio/ogg"}
_FORWARD_HEADERS = {"user-agent", "accept", "accept-language", "sec-fetch-mode"}


@dataclass
class Resolved:
    video_id: str
    url: str
    headers: dict
    ext: str
    mime: str
    expires_at: float
    request: PrepareRequest | None = None  # what the background MP3 cache job will download
    cache_scheduled: bool = False
    head: bytes | None = None      # the first HEAD_BYTES of the audio, fetched ahead of time
    total_size: int | None = None  # full file size, learned from that same request

    @property
    def fresh(self) -> bool:
        return time.time() < self.expires_at - URL_SAFETY_S


_resolved: dict[str, Resolved] = {}
_inflight: dict[str, asyncio.Task] = {}
_warm_slots = asyncio.Semaphore(CONCURRENT_WARMS)
_tasks: set[asyncio.Task] = set()

# ── Remembered song → video matches ─────────────────────────────────────────────
# The YouTube search is the slowest, least predictable step (1–5s). Once a song has been
# matched to a video it never needs searching again — not after the stream URL expires, and
# not after a restart — so the match is kept on disk.
_IDS_FILE = CACHE_DIR / "video_ids.json"
_MAX_IDS = 3000


def _load_ids() -> dict[str, str]:
    try:
        data = json.loads(_IDS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


_video_ids: dict[str, str] = _load_ids()


def _remember_video(track_id: str, video_id: str) -> None:
    if _video_ids.get(track_id) == video_id:
        return
    _video_ids[track_id] = video_id
    while len(_video_ids) > _MAX_IDS:
        _video_ids.pop(next(iter(_video_ids)))
    try:
        tmp = _IDS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(_video_ids), encoding="utf-8")
        tmp.replace(_IDS_FILE)
    except OSError as e:
        log.debug("couldn't save video id map: %s", e)


# One client for every proxied stream: reusing connections to Google's servers skips the
# TLS handshake on each seek and each new song.
_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, read=30.0),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _client


def _expiry(url: str) -> float:
    try:
        return float(parse_qs(urlparse(url).query)["expire"][0])
    except (KeyError, ValueError, IndexError):
        return time.time() + DEFAULT_TTL_S


def _extract(video_id: str) -> Resolved:
    ydl = shared_ydl("extract", {**_base_opts(), "format": "bestaudio[ext=m4a]/bestaudio"})
    try:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    except yt_dlp.utils.DownloadError as e:
        raise RuntimeError(_clean_error(e)) from e

    url = info.get("url")
    if not url:
        raise RuntimeError("No direct audio URL for this video")
    ext = info.get("ext") or "m4a"
    headers = {k: v for k, v in (info.get("http_headers") or {}).items() if k.lower() in _FORWARD_HEADERS}
    return Resolved(video_id, url, headers, ext, _MIME.get(ext, "audio/mp4"), _expiry(url))


def _resolve_blocking(req: PrepareRequest, known_video_id: str | None) -> Resolved:
    remembered = known_video_id or req.yt_video_id or _video_ids.get(req.track_id)
    if remembered:
        try:
            return _extract(remembered)
        except RuntimeError:
            # The remembered video may have been removed or gone private — search afresh once
            if req.yt_video_id:
                raise  # the user asked for exactly this video; a different one would be wrong
            _video_ids.pop(req.track_id, None)

    video_id = _pick_video(f"{req.artist} - {req.title} audio", req.duration_ms / 1000)
    return _extract(video_id)


def _remember(track_id: str, r: Resolved) -> None:
    _resolved[track_id] = r
    _remember_video(track_id, r.video_id)
    while len(_resolved) > MAX_ENTRIES:
        _resolved.pop(next(iter(_resolved)))  # dicts keep insertion order → drops the oldest


async def resolve(req: PrepareRequest) -> Resolved:
    """Direct audio URL for a track. Concurrent callers for the same track share one lookup."""
    tid = req.track_id
    current = _resolved.get(tid)
    if current and current.fresh:
        return current

    task = _inflight.get(tid)
    if task is None:
        # An expired URL still knows which video it was — re-extract without searching again
        known = current.video_id if current else None

        async def work() -> Resolved:
            r = await asyncio.get_running_loop().run_in_executor(None, _resolve_blocking, req, known)
            # The exact video the stream uses, so the cached copy is identical and needs no search
            r.request = req.model_copy(update={"yt_video_id": r.video_id})
            _remember(tid, r)
            return r

        task = asyncio.create_task(work())
        _inflight[tid] = task
        task.add_done_callback(lambda _t: _inflight.pop(tid, None))

    # shield: one caller disconnecting must not cancel the lookup other callers are awaiting
    return await asyncio.shield(task)


async def _prime(r: Resolved) -> None:
    """Fetch the start of the audio now, so that when the song is played it can begin from
    memory instead of waiting ~1s for a round trip to Google's server."""
    try:
        resp = await client().get(r.url, headers={**r.headers, "Range": f"bytes=0-{HEAD_BYTES - 1}"})
        if resp.status_code != 206:
            return
        match = re.match(r"bytes 0-\d+/(\d+)", resp.headers.get("content-range", ""))
        if match:
            r.head, r.total_size = resp.content, int(match.group(1))
    except httpx.HTTPError as e:
        log.debug("couldn't prime %s: %s", r.video_id, e)


def parse_range(header: str | None, total: int) -> tuple[int, int] | None:
    """'bytes=START-END' → (start, end) inclusive, clamped to the file. None if unusable."""
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", (header or "").strip())
    if not m or (not m.group(1) and not m.group(2)):
        return None
    if not m.group(1):  # suffix range: the last N bytes
        n = int(m.group(2))
        return max(total - n, 0), total - 1
    start = int(m.group(1))
    end = min(int(m.group(2)), total - 1) if m.group(2) else total - 1
    return (start, end) if start <= end else None


def warm(req: PrepareRequest) -> None:
    """Resolve in the background so a later play is nearly instant. Never raises. Waits its turn
    behind other warm-ups — but resolve() itself never queues, so a real play skips the line."""
    async def go() -> None:
        try:
            async with _warm_slots:
                resolved = await resolve(req)
                if resolved.head is None:
                    await _prime(resolved)
        except Exception as e:
            log.debug("warm-up of %s failed: %s", req.track_id, e)

    t = asyncio.create_task(go())
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


def get(track_id: str) -> Resolved | None:
    return _resolved.get(track_id)


def forget(track_id: str) -> None:
    _resolved.pop(track_id, None)


def pick_headers(source: httpx.Response) -> dict:
    """The response headers a media element needs to play and seek."""
    return {
        k: source.headers[k]
        for k in ("content-length", "content-range", "accept-ranges")
        if k in source.headers
    }
