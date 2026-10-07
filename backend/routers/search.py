import asyncio
import re
import time
from fastapi import APIRouter, HTTPException, Query
import yt_dlp
from services.youtube import _base_opts, _clean_error, shared_ydl
from services.ids import stable_id

router = APIRouter(prefix="/api/search", tags=["search"])

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

# "Songs like this" come from YouTube's own Mix (its radio for a video), so what plays next
# follows YouTube's idea of taste — same artist, same era, same kind of listener.
MIX_FETCH = 30                 # entries requested from the Mix
SIMILAR_MIN_S = 60             # skip clips and jingles…
SIMILAR_MAX_S = 10 * 60        # …and hour-long mixes / full albums
SIMILAR_TTL_S = 15 * 60
_similar_cache: dict[str, tuple[float, list]] = {}


def _entry_to_result(entry: dict | None) -> dict | None:
    if not entry or not entry.get("id"):
        return None
    vid = entry["id"]
    thumbs = entry.get("thumbnails") or []
    cover = thumbs[-1]["url"] if thumbs else entry.get("thumbnail")
    duration_s = entry.get("duration") or 0
    return {
        "id": stable_id("yt", vid),
        "yt_id": vid,
        "yt_video_id": vid,
        "title": entry.get("title") or "Unknown title",
        "artist": entry.get("uploader") or entry.get("channel") or "Unknown artist",
        "album": "YouTube",
        "duration": duration_s,
        "duration_ms": int(duration_s * 1000),
        "cover_url": cover,
        "thumbnail": cover,
    }


SEARCH_TTL_S = 10 * 60
_search_cache: dict[tuple, tuple[float, list]] = {}


def _search_sync(q: str, n: int = 5, songs_only: bool = False) -> list:
    """Top YouTube matches. songs_only drops clips and hour-long mixes/compilations (used for
    genre pages, where a search like "tamil kuthu songs" is full of them)."""
    key = (q.lower(), n, songs_only)
    cached = _search_cache.get(key)
    if cached and time.monotonic() - cached[0] < SEARCH_TTL_S:
        return cached[1]

    opts = {
        **_base_opts(),
        "extract_flat": True,
    }
    # Leave room for the ones that get filtered out — many queries are half compilations
    fetch = min(n * 3, 60) if songs_only else n
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"ytsearch{fetch}:{q}", download=False)

    results = [r for r in (_entry_to_result(e) for e in info.get("entries", [])) if r]
    if songs_only:
        results = [r for r in results if SIMILAR_MIN_S <= r["duration"] <= SIMILAR_MAX_S]
    results = results[:n]

    if results:
        if len(_search_cache) >= 100:
            _search_cache.pop(min(_search_cache, key=lambda k: _search_cache[k][0]))
        _search_cache[key] = (time.monotonic(), results)
    return results


def _similar_sync(video_id: str, limit: int) -> list:
    opts = {**_base_opts(), "extract_flat": "in_playlist", "playlistend": MIX_FETCH}
    opts.pop("noplaylist", None)  # the Mix *is* a playlist
    ydl = shared_ydl("mix", opts)
    try:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}&list=RD{video_id}", download=False
        )
    except yt_dlp.utils.DownloadError as e:
        raise RuntimeError(_clean_error(e)) from e

    seen = {video_id}
    results = []
    for entry in info.get("entries") or []:
        result = _entry_to_result(entry)
        if not result or result["yt_video_id"] in seen:
            continue
        if not SIMILAR_MIN_S <= result["duration"] <= SIMILAR_MAX_S:
            continue
        seen.add(result["yt_video_id"])
        results.append(result)
        if len(results) >= limit:
            break
    return results


@router.get("")
async def search_tracks(
    q: str = Query(..., min_length=1),
    n: int = Query(5, ge=1, le=30),
    songs_only: bool = False,
):
    loop = asyncio.get_running_loop()
    results = await loop.run_in_executor(None, _search_sync, q, n, songs_only)
    return {"results": results}


@router.get("/similar")
async def similar_tracks(video_id: str = Query(...), limit: int = Query(15, ge=1, le=25)):
    """Songs that go well after the given YouTube video — what plays next in autoplay."""
    if not VIDEO_ID_RE.fullmatch(video_id):
        raise HTTPException(400, "Not a YouTube video id")

    cached = _similar_cache.get(video_id)
    if cached and time.monotonic() - cached[0] < SIMILAR_TTL_S:
        return {"results": cached[1][:limit]}

    loop = asyncio.get_running_loop()
    try:
        results = await loop.run_in_executor(None, _similar_sync, video_id, 25)
    except RuntimeError as e:
        raise HTTPException(502, f"Couldn't find similar songs: {e}") from e

    if results:  # an empty answer is worth asking again for
        if len(_similar_cache) >= 200:
            _similar_cache.pop(min(_similar_cache, key=lambda k: _similar_cache[k][0]))
        _similar_cache[video_id] = (time.monotonic(), results)
    return {"results": results[:limit]}
