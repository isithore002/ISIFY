import os
import asyncio
import shutil
import threading
from pathlib import Path
from urllib.parse import urlparse
import yt_dlp
from models.track import TRACK_ID_RE, TrackMeta, PlaylistMeta
from services.ids import stable_id

CACHE_DIR = Path(os.getenv("CACHE_DIR", "./cache")).resolve()
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SEARCH_RESULTS = 5
DURATION_TOLERANCE_S = 15
PLAYLIST_LIMIT = 300  # protects against accidentally bulk-downloading a huge playlist

HOSTS = {"youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}


def _find_ffmpeg() -> str | None:
    """System ffmpeg if installed, otherwise the binary bundled with the imageio-ffmpeg package."""
    if path := shutil.which("ffmpeg"):
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


FFMPEG = _find_ffmpeg()

# yt-dlp needs a JavaScript runtime to solve YouTube's player challenges; it only
# enables deno by default, so also allow node/bun when those are what's installed.
JS_RUNTIMES = {name: {} for name in ("deno", "node", "bun") if shutil.which(name)}


def _mp3_path(track_id: str) -> Path:
    if not TRACK_ID_RE.fullmatch(track_id):
        raise ValueError(f"Invalid track id: {track_id!r}")
    return CACHE_DIR / f"{track_id}.mp3"


def is_cached(track_id: str) -> bool:
    return _mp3_path(track_id).exists()


def get_mp3_path(track_id: str) -> Path | None:
    p = _mp3_path(track_id)
    return p if p.exists() else None


def _base_opts() -> dict:
    opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "noprogress": True}
    if JS_RUNTIMES:
        opts["js_runtimes"] = JS_RUNTIMES
    return opts


def _meta_opts() -> dict:
    """For reading metadata only (no download): playlist-aware, doesn't fetch full video info."""
    opts = _base_opts()
    opts.pop("noplaylist", None)
    opts["extract_flat"] = "in_playlist"
    return opts


def _download_opts(output_path: str) -> dict:
    return {
        **_base_opts(),
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "ffmpeg_location": FFMPEG,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    }


def _clean_error(e: Exception) -> str:
    msg = str(e)
    return msg[7:] if msg.startswith("ERROR: ") else msg


# ── Resolving a YouTube link into track metadata (no download) ───────────────

def _entry_cover(e: dict) -> str | None:
    thumbs = e.get("thumbnails") or []
    return thumbs[-1]["url"] if thumbs else e.get("thumbnail")


def _entry_to_track(e: dict, index: int) -> TrackMeta:
    vid = e["id"]
    return TrackMeta(
        id=stable_id("yt", vid),
        title=e.get("title") or "Unknown title",
        artist=e.get("uploader") or e.get("channel") or "Unknown artist",
        album="",
        duration_ms=int((e.get("duration") or 0) * 1000),
        cover_url=_entry_cover(e),
        track_number=index + 1,
        yt_video_id=vid,
    )


def resolve_youtube(url: str) -> PlaylistMeta:
    """A YouTube video or playlist link → track metadata. Videos download exactly (no search)."""
    try:
        with yt_dlp.YoutubeDL(_meta_opts()) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise ValueError(_clean_error(e)) from e

    entries = [e for e in (info.get("entries") or []) if e and e.get("id")]
    if entries:
        notice = None
        if len(entries) > PLAYLIST_LIMIT:
            notice = f"This playlist has {len(entries)} videos — only the first {PLAYLIST_LIMIT} were imported."
            entries = entries[:PLAYLIST_LIMIT]
        tracks = [_entry_to_track(e, i) for i, e in enumerate(entries)]
        return PlaylistMeta(
            id=stable_id("yt", info.get("id") or url),
            name=info.get("title") or "YouTube playlist",
            cover_url=None,
            owner=info.get("uploader") or info.get("channel") or "YouTube",
            tracks=tracks,
            notice=notice,
        )

    if not info.get("id"):
        raise ValueError("That doesn't look like a YouTube video or playlist link")
    track = _entry_to_track(info, 0)
    return PlaylistMeta(id=track.id, name=track.title, cover_url=track.cover_url,
                        owner=track.artist, tracks=[track])


# ── Downloading ────────────────────────────────────────────────────────────

_tls = threading.local()


def shared_ydl(kind: str, opts: dict) -> yt_dlp.YoutubeDL:
    """A YoutubeDL kept alive per worker thread and per purpose. A fresh instance throws away
    everything yt-dlp has warmed up (session, player data), which made every lookup slower;
    reusing one measured ~1.5s vs ~2.5–3.7s for the URL extraction when YouTube is responsive.
    Per-thread, because a YoutubeDL object isn't safe to use from two threads at once."""
    ydl = getattr(_tls, kind, None)
    if ydl is None:
        ydl = yt_dlp.YoutubeDL(opts)
        setattr(_tls, kind, ydl)
    return ydl


def _pick_video(query: str, duration_s: float) -> str:
    """Top search results → the first one whose length matches the Spotify track."""
    ydl = shared_ydl("search", {**_base_opts(), "extract_flat": "in_playlist"})
    info = ydl.extract_info(f"ytsearch{SEARCH_RESULTS}:{query}", download=False)
    entries = [e for e in info.get("entries") or [] if e and e.get("id")]
    if not entries:
        raise RuntimeError(f"No YouTube results for {query!r}")

    if duration_s:
        timed = [e for e in entries if e.get("duration")]
        close = [e for e in timed if abs(e["duration"] - duration_s) <= DURATION_TOLERANCE_S]
        if close:
            return close[0]["id"]  # keep YouTube's relevance order among good matches
        if timed:
            return min(timed, key=lambda e: abs(e["duration"] - duration_s))["id"]
    return entries[0]["id"]


def _run_download(video_id: str, track_id: str) -> Path:
    if not FFMPEG:
        raise RuntimeError("ffmpeg not found — run `pip install imageio-ffmpeg` or install FFmpeg")

    # Download under a temp name; the caller renames it once tagging is done,
    # so a half-written file is never mistaken for a cached track.
    _mp3_path(track_id)  # validates the id
    out_template = str(CACHE_DIR / f"{track_id}.part.%(ext)s")
    try:
        with yt_dlp.YoutubeDL(_download_opts(out_template)) as ydl:
            ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    except yt_dlp.utils.DownloadError as e:
        raise RuntimeError(_clean_error(e)) from e

    tmp = CACHE_DIR / f"{track_id}.part.mp3"
    if not tmp.exists():
        raise RuntimeError(f"Download produced no MP3 for video {video_id}")
    return tmp


def _download_by_search(query: str, track_id: str, duration_s: float) -> Path:
    video_id = _pick_video(query, duration_s)
    return _run_download(video_id, track_id)


async def fetch_audio(title: str, artist: str, track_id: str, duration_ms: int = 0,
                      video_id: str | None = None) -> Path:
    """Downloads audio to a temporary MP3 in the cache dir and returns its path.
    A direct YouTube import (video_id set) downloads that exact video — no search."""
    loop = asyncio.get_running_loop()
    if video_id:
        return await loop.run_in_executor(None, _run_download, video_id, track_id)
    query = f"{artist} - {title} audio"
    return await loop.run_in_executor(None, _download_by_search, query, track_id, duration_ms / 1000)
