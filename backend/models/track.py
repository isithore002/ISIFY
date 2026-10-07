import re
from pydantic import BaseModel, Field
from typing import Optional

# Spotify's own 22-char base62 ids
SPOTIFY_ID_RE = re.compile(r"^[A-Za-z0-9]{22}$")

# Every track id, whatever the source platform: Spotify's own id, or "<platform>_<id/hash>"
# for everything else. Bounded, alnum/-/_ only, so it can never be used to escape the cache dir.
TRACK_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,64}$")


class TrackMeta(BaseModel):
    id: str
    title: str
    artist: str
    album: str
    duration_ms: int
    cover_url: Optional[str] = None
    track_number: int = 0
    yt_video_id: Optional[str] = None  # set for YouTube imports: download this exact video, skip search


class PlaylistMeta(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    cover_url: Optional[str] = None
    owner: str
    tracks: list[TrackMeta]
    notice: Optional[str] = None  # shown to the user, e.g. when the track list is incomplete


class TrackStatus(BaseModel):
    track_id: str
    status: str  # "pending" | "ready" | "error"
    cached: bool = False
    error: Optional[str] = None


class PrepareRequest(BaseModel):
    track_id: str = Field(pattern=TRACK_ID_RE.pattern)
    title: str
    artist: str
    album: str = ""
    track_number: int = 0
    duration_ms: int = 0  # lets the YouTube search pick the upload whose length matches
    cover_url: str | None = None
    yt_video_id: str | None = None  # download this exact YouTube video, skip search-and-match


class PlayResponse(BaseModel):
    url: str        # path on this backend the browser should load
    format: str     # "mp3" for a cached file; "m4a"/"webm" for a live stream
    source: str     # "cache" | "live"


class WarmRequest(BaseModel):
    tracks: list[PrepareRequest] = Field(max_length=6)
    cache: bool = False  # also download + tag in the background (for the next song in a queue)
