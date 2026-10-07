import asyncio
import logging
from pathlib import Path
from models.track import PrepareRequest, SPOTIFY_ID_RE
from services.youtube import fetch_audio, get_mp3_path
from services.tagger import embed_tags
from services.spotify import track_cover_url

log = logging.getLogger(__name__)

# track_id → asyncio.Event so parallel requests wait instead of double-downloading
_in_progress: dict[str, asyncio.Event] = {}


def is_pending(track_id: str) -> bool:
    return track_id in _in_progress


async def prepare(req: PrepareRequest) -> Path:
    """Download + tag a track unless it's already cached. Returns the MP3 path."""
    tid = req.track_id

    cached = get_mp3_path(tid)
    if cached:
        return cached

    if tid in _in_progress:
        await _in_progress[tid].wait()
        path = get_mp3_path(tid)
        if path:
            return path
        raise RuntimeError("Download failed")

    evt = asyncio.Event()
    _in_progress[tid] = evt
    tmp: Path | None = None
    try:
        tmp = await fetch_audio(req.title, req.artist, tid, req.duration_ms, req.yt_video_id)
        # Playlists imported from Spotify's embed page have no per-track cover; only worth
        # asking Spotify for one when this is actually a Spotify track id.
        cover = req.cover_url
        if not cover and SPOTIFY_ID_RE.fullmatch(tid):
            cover = await track_cover_url(tid)
        await embed_tags(tmp, req.title, req.artist, req.album, req.track_number, cover)
        final = tmp.with_name(f"{tid}.mp3")
        tmp.replace(final)
        return final
    finally:
        if tmp is not None and tmp.exists():
            tmp.unlink(missing_ok=True)
        evt.set()
        _in_progress.pop(tid, None)


# ── Background caching (prefetch) ────────────────────────────────────────────

_cache_slots = asyncio.Semaphore(1)  # prefetching must never crowd out a song someone is waiting on
_scheduled: set[str] = set()
_bg: set[asyncio.Task] = set()


def schedule_cache(req: PrepareRequest) -> None:
    """Download + tag in the background so the next play comes from disk. Never raises."""
    tid = req.track_id
    if tid in _scheduled or tid in _in_progress or get_mp3_path(tid):
        return
    _scheduled.add(tid)

    async def go() -> None:
        try:
            async with _cache_slots:
                await prepare(req)
        except Exception as e:
            log.info("background cache of %s failed: %s", tid, e)
        finally:
            _scheduled.discard(tid)

    t = asyncio.create_task(go())
    _bg.add(t)
    t.add_done_callback(_bg.discard)
