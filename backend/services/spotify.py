import os
import re
import json
import logging
import httpx
import spotipy
from spotipy.cache_handler import MemoryCacheHandler
from spotipy.exceptions import SpotifyException
from spotipy.oauth2 import SpotifyClientCredentials
from models.track import TrackMeta, PlaylistMeta

log = logging.getLogger(__name__)

_sp: spotipy.Spotify | None = None

HOSTS = {"open.spotify.com", "spotify.com", "play.spotify.com"}

# open.spotify.com/playlist/<id>, /intl-xx/album/<id>, /embed/track/<id>, spotify:playlist:<id>
_URL_RE = re.compile(r"(playlist|album|track)[/:]([A-Za-z0-9]{22})")

_EMBED_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36",
    "Accept-Language": "en",
}
_NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
EMBED_TRACK_LIMIT = 100  # Spotify's embed page never lists more than this


def parse_url(url: str) -> tuple[str, str]:
    """Returns (kind, id) where kind is 'playlist' | 'album' | 'track'."""
    m = _URL_RE.search(url.strip())
    if not m:
        raise ValueError("Not a Spotify playlist, album or track link")
    return m.group(1), m.group(2)


# ── Official Web API (needs Premium on the app owner's account) ──────────────

def _client() -> spotipy.Spotify | None:
    """App-level (client credentials) token, or None when no credentials are configured."""
    global _sp
    if _sp is None:
        client_id = os.getenv("SPOTIFY_CLIENT_ID")
        client_secret = os.getenv("SPOTIFY_CLIENT_SECRET")
        if not client_id or not client_secret:
            return None
        auth = SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret,
            cache_handler=MemoryCacheHandler(),
        )
        _sp = spotipy.Spotify(auth_manager=auth, requests_timeout=10, retries=0, status_retries=0)
    return _sp


def _parse_api_track(item: dict) -> TrackMeta | None:
    t = item.get("track")
    if not t or not t.get("id") or t.get("type") != "track":
        return None
    album = t.get("album") or {}
    album_images = album.get("images") or []
    return TrackMeta(
        id=t["id"],
        title=t["name"],
        artist=", ".join(a["name"] for a in t.get("artists", [])),
        album=album.get("name", ""),
        duration_ms=t.get("duration_ms", 0),
        cover_url=album_images[0]["url"] if album_images else None,
        track_number=t.get("track_number", 0),
    )


def _fetch_playlist_api(sp: spotipy.Spotify, playlist_id: str) -> PlaylistMeta:
    pl = sp.playlist(
        playlist_id,
        fields="id,name,description,images,owner,"
        "tracks.items(track(id,name,artists,album,duration_ms,track_number,type)),tracks.next",
    )
    images = pl.get("images") or []

    tracks: list[TrackMeta] = []
    page = pl["tracks"]
    while page:
        for item in page.get("items") or []:
            track = _parse_api_track(item)
            if track:
                tracks.append(track)
        page = sp.next(page) if page.get("next") else None

    return PlaylistMeta(
        id=pl["id"],
        name=pl["name"],
        description=pl.get("description", ""),
        cover_url=images[0]["url"] if images else None,
        owner=pl["owner"]["display_name"],
        tracks=tracks,
    )


# ── Public embed page (no API access needed; max 100 tracks, no album names) ─

def _embed_entity(kind: str, spotify_id: str) -> dict:
    r = httpx.get(f"https://open.spotify.com/embed/{kind}/{spotify_id}",
                  headers=_EMBED_HEADERS, timeout=15, follow_redirects=True)
    if r.status_code == 404:
        raise ValueError(f"Spotify {kind} not found (is it private?)")
    r.raise_for_status()
    m = _NEXT_DATA_RE.search(r.text)
    if not m:
        raise RuntimeError("Spotify embed page changed format — couldn't find track data")
    try:
        return json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"]
    except (KeyError, TypeError) as e:
        raise RuntimeError("Spotify embed page changed format — couldn't find track data") from e


def _best_image(entity: dict) -> str | None:
    images = (entity.get("visualIdentity") or {}).get("image") or []
    if images:
        return max(images, key=lambda i: i.get("maxHeight") or 0)["url"]
    sources = (entity.get("coverArt") or {}).get("sources") or []
    return sources[0]["url"] if sources else None


def _artists(subtitle: str) -> str:
    # Embed joins artists with ",\xa0"
    return ", ".join(a.strip() for a in subtitle.replace("\xa0", " ").split(",") if a.strip())


def _fetch_embed(kind: str, spotify_id: str) -> PlaylistMeta:
    e = _embed_entity(kind, spotify_id)
    cover = _best_image(e)

    if kind == "track":
        artists = ", ".join(a["name"] for a in e.get("artists") or [])
        track = TrackMeta(id=e["id"], title=e.get("title") or e["name"], artist=artists,
                          album="", duration_ms=e.get("duration") or 0, cover_url=cover)
        return PlaylistMeta(id=e["id"], name=track.title, cover_url=cover, owner=artists,
                            tracks=[track])

    tracks: list[TrackMeta] = []
    for i, t in enumerate(e.get("trackList") or []):
        tid = (t.get("uri") or "").rsplit(":", 1)[-1]
        if t.get("entityType") != "track" or len(tid) != 22:
            continue  # podcast episodes, local files
        tracks.append(TrackMeta(
            id=tid,
            title=t["title"],
            artist=_artists(t.get("subtitle", "")),
            # Playlist embeds carry no per-track album/cover; covers are looked up at download time
            album=e["name"] if kind == "album" else "",
            duration_ms=t.get("duration") or 0,
            cover_url=cover if kind == "album" else None,
            track_number=i + 1 if kind == "album" else 0,
        ))

    notice = None
    if kind == "playlist" and len(e.get("trackList") or []) >= EMBED_TRACK_LIMIT:
        notice = (f"Without Spotify API access only the first {EMBED_TRACK_LIMIT} songs "
                  "of a playlist can be read — this one may have more.")

    return PlaylistMeta(
        id=e["id"],
        name=e["name"],
        description="",
        cover_url=cover,
        owner=_artists(e.get("subtitle", "")),
        tracks=tracks,
        notice=notice,
    )


def fetch_playlist(url: str) -> PlaylistMeta:
    """Playlist/album/track link → track list. Official API first, public embed page as fallback."""
    kind, spotify_id = parse_url(url)

    sp = _client()
    if kind == "playlist" and sp is not None:
        try:
            return _fetch_playlist_api(sp, spotify_id)
        except SpotifyException as e:
            # 403 = no Premium on the app owner, 404 = editorial playlist hidden from new apps, …
            log.info("Spotify API refused playlist %s (%s) — using embed page", spotify_id, e.http_status)

    return _fetch_embed(kind, spotify_id)


async def track_cover_url(track_id: str) -> str | None:
    """Album art for one track via its embed page (used when the import had no cover)."""
    try:
        async with httpx.AsyncClient(headers=_EMBED_HEADERS, timeout=10, follow_redirects=True) as c:
            r = await c.get(f"https://open.spotify.com/embed/track/{track_id}")
        m = _NEXT_DATA_RE.search(r.text)
        if not m:
            return None
        return _best_image(json.loads(m.group(1))["props"]["pageProps"]["state"]["data"]["entity"])
    except Exception:
        return None
