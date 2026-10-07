import re
import httpx
from urllib.parse import urlparse
from models.track import TrackMeta, PlaylistMeta
from services.ids import stable_id

HOSTS = {"soundcloud.com", "on.soundcloud.com", "m.soundcloud.com"}

_TITLE_BY_RE = re.compile(r"^(.+) by (.+)$")


def fetch(url: str) -> PlaylistMeta:
    if "/sets/" in urlparse(url).path:
        raise ValueError("SoundCloud playlists (sets) aren't supported yet — try a single track link")

    r = httpx.get("https://soundcloud.com/oembed", params={"format": "json", "url": url}, timeout=15)
    if r.status_code == 404:
        raise ValueError("SoundCloud track not found (private, or the link is wrong)")
    r.raise_for_status()
    data = r.json()

    title = data.get("title") or "Unknown title"
    artist = data.get("author_name") or "Unknown artist"
    # oEmbed titles are sometimes "Title by Artist" even though author_name is also set
    if m := _TITLE_BY_RE.match(title):
        title = m.group(1).strip()
        if not data.get("author_name"):
            artist = m.group(2).strip()

    track = TrackMeta(id=stable_id("sc", url), title=title, artist=artist, album="",
                      duration_ms=0, cover_url=data.get("thumbnail_url"))
    return PlaylistMeta(id=track.id, name=track.title, cover_url=track.cover_url,
                        owner=track.artist, tracks=[track])
