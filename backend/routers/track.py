import asyncio
import logging
from pathlib import Path
import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi import Path as PathParam
from fastapi.responses import FileResponse, StreamingResponse
from services.youtube import is_cached, get_mp3_path
from services.prepare import prepare, is_pending, schedule_cache
from services import stream
from models.track import TrackStatus, PrepareRequest, PlayResponse, WarmRequest, TRACK_ID_RE

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/track", tags=["track"])

TRACK_ID_PATTERN = TRACK_ID_RE.pattern


def _audio_response(path: Path, filename: str | None = None) -> FileResponse:
    # FileResponse handles Range requests, so <audio>/expo-av can seek
    return FileResponse(path=str(path), media_type="audio/mpeg", filename=filename)


@router.post("/prepare", response_model=TrackStatus)
async def prepare_track(req: PrepareRequest):
    """Download + tag (if not cached yet); returns once the file is ready."""
    try:
        await prepare(req)
        return TrackStatus(track_id=req.track_id, status="ready", cached=True)
    except Exception as e:
        return TrackStatus(track_id=req.track_id, status="error", error=str(e))


@router.post("/play", response_model=PlayResponse)
async def play_track(req: PrepareRequest):
    """Fastest way to start a song. Cached MP3 → served from disk. Otherwise resolve a direct
    audio URL and stream it live (playback starts in ~a second instead of after the whole
    download → convert → tag pipeline), caching the MP3 in the background for next time."""
    file_url = f"/api/track/{req.track_id}/file"
    if get_mp3_path(req.track_id):
        return PlayResponse(url=file_url, format="mp3", source="cache")

    try:
        resolved = await stream.resolve(req)
    except Exception as live_error:
        log.info("live stream unavailable for %s (%s) — using the full pipeline", req.track_id, live_error)
        try:
            await prepare(req)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return PlayResponse(url=file_url, format="mp3", source="cache")

    # (The MP3 is cached later, from /live once the stream is underway — starting that download
    # here would compete with the very stream the listener is waiting on.)
    return PlayResponse(url=f"/api/track/{req.track_id}/live", format=resolved.ext, source="live")


@router.post("/warm")
async def warm_tracks(body: WarmRequest):
    """Get songs ready before they're played (hover, opened playlist, next in queue)."""
    for t in body.tracks:
        if get_mp3_path(t.track_id):
            continue
        stream.warm(t)
        if body.cache:
            schedule_cache(t)
    return {"queued": len(body.tracks)}


@router.get("/{track_id}/live")
async def live_stream(request: Request, track_id: str = PathParam(pattern=TRACK_ID_PATTERN)):
    """Proxy the resolved audio (with Range support, so seeking works). Call /play first."""
    resolved = stream.get(track_id)
    if not resolved:
        raise HTTPException(status_code=404, detail="Not resolved. Call /play first.")

    headers = dict(resolved.headers)
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header

    http = stream.client()

    # The start of this song was fetched ahead of time (hover / next-in-queue). Send that
    # immediately, and only then ask for the remainder — so playback begins without waiting
    # on a round trip to Google's server.
    span = stream.parse_range(range_header, resolved.total_size) if (resolved.head and resolved.total_size) else None
    if span and span[0] == 0:
        start, end = span
        head = resolved.head[: end + 1]

        async def head_then_rest():
            yield head
            if end + 1 > len(head):
                rest = {**resolved.headers, "Range": f"bytes={len(head)}-{end}"}
                upstream = await http.send(http.build_request("GET", resolved.url, headers=rest), stream=True)
                try:
                    if upstream.status_code >= 400:
                        stream.forget(track_id)
                        return
                    async for chunk in upstream.aiter_raw(64 * 1024):
                        yield chunk
                finally:
                    await upstream.aclose()

        if resolved.request and not resolved.cache_scheduled:
            resolved.cache_scheduled = True
            asyncio.get_running_loop().call_later(stream.CACHE_DELAY_S, schedule_cache, resolved.request)

        return StreamingResponse(
            head_then_rest(),
            status_code=206,
            media_type=resolved.mime,
            headers={
                "Content-Length": str(end + 1),
                "Content-Range": f"bytes 0-{end}/{resolved.total_size}",
                "Accept-Ranges": "bytes",
            },
        )

    try:
        upstream = await http.send(http.build_request("GET", resolved.url, headers=headers), stream=True)
    except httpx.HTTPError as e:
        stream.forget(track_id)
        raise HTTPException(status_code=502, detail=f"Couldn't reach the audio source: {e}")
    if upstream.status_code >= 400:
        await upstream.aclose()
        stream.forget(track_id)  # expired or refused → the next /play resolves a fresh URL
        raise HTTPException(status_code=502, detail=f"Audio source answered {upstream.status_code}")

    # First time this song is being streamed: cache the MP3 for next time (offline, downloads,
    # instant replays) — but only after a delay, so it doesn't slow the stream that's starting.
    if resolved.request and not resolved.cache_scheduled:
        resolved.cache_scheduled = True
        asyncio.get_running_loop().call_later(stream.CACHE_DELAY_S, schedule_cache, resolved.request)

    async def body():
        try:
            async for chunk in upstream.aiter_raw(64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()

    return StreamingResponse(
        body(),
        status_code=upstream.status_code,
        media_type=resolved.mime,
        headers=stream.pick_headers(upstream),
    )


@router.get("/{track_id}/status", response_model=TrackStatus)
async def track_status(track_id: str = PathParam(pattern=TRACK_ID_PATTERN)):
    cached = is_cached(track_id)
    pending = is_pending(track_id)
    status = "ready" if cached else ("pending" if pending else "not_found")
    return TrackStatus(track_id=track_id, status=status, cached=cached)


@router.get("/{track_id}/file")
async def get_track_file(track_id: str = PathParam(pattern=TRACK_ID_PATTERN)):
    """Serve a cached MP3 (seekable). Call /prepare first."""
    path = get_mp3_path(track_id)
    if not path:
        raise HTTPException(status_code=404, detail="Not cached. Call /prepare first.")
    return _audio_response(path)


@router.post("/{track_id}/download")
async def download_track(req: PrepareRequest, track_id: str = PathParam(pattern=TRACK_ID_PATTERN)):
    """Prepare (if needed) then serve as attachment download."""
    if req.track_id != track_id:
        raise HTTPException(status_code=400, detail="track_id in path and body differ")
    try:
        path = await prepare(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    # FileResponse builds a correctly encoded Content-Disposition (RFC 5987) for any title
    filename = f"{req.artist} - {req.title}.mp3".replace("/", "-")
    return _audio_response(path, filename=filename)
