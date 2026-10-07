"""Dispatches an imported link to the right platform, by hostname."""
import re
import html
import httpx
from urllib.parse import urlparse
from models.track import TrackMeta, PlaylistMeta
from services.ids import stable_id
from services import spotify, apple_music, soundcloud
from services.youtube import HOSTS as YOUTUBE_HOSTS, resolve_youtube

# Platforms whose song data is only ever loaded client-side after signing in — there is no
# page, API or oEmbed endpoint that returns it, so scraping them is a dead end, not a bug to fix.
UNREADABLE_HOSTS = {
    "music.amazon": "Amazon Music",
    "deezer.com": "Deezer",
}

_GENERIC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36",
}
_OG_RE = re.compile(r'<meta[^>]+property="og:(\w+)"[^>]+content="([^"]*)"', re.I)
_TITLE_BY_RE = re.compile(r"^(.+) by (.+)$")


def _host(url: str) -> str:
    h = (urlparse(url).hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


def _generic_fallback(url: str, host: str) -> PlaylistMeta:
    """Last resort for any site not explicitly supported: read its social-share preview tags."""
    og = {}
    try:
        r = httpx.get(url, headers=_GENERIC_HEADERS, timeout=15, follow_redirects=True)
        r.raise_for_status()
        og = {k: html.unescape(v) for k, v in _OG_RE.findall(r.text)}
    except httpx.HTTPError:
        pass

    if not og.get("type", "").startswith("music.") or not og.get("title"):
        raise ValueError(
            f"WaveVault doesn't know how to read {host} links yet. "
            "Try a Spotify, YouTube, Apple Music or SoundCloud link for this song instead."
        )

    title, artist = og["title"], "Unknown artist"
    if m := _TITLE_BY_RE.match(title):
        title, artist = m.group(1).strip(), m.group(2).strip()

    track = TrackMeta(id=stable_id("gn", url), title=title, artist=artist, album="",
                      duration_ms=0, cover_url=og.get("image"))
    return PlaylistMeta(id=track.id, name=track.title, cover_url=track.cover_url, owner=artist,
                        tracks=[track],
                        notice="Imported from this page's sharing preview — the YouTube match may not be exact.")


def resolve(url: str) -> PlaylistMeta:
    raw = url.strip()
    if not raw:
        raise ValueError("Paste a link first")
    if raw.startswith("spotify:"):
        return spotify.fetch_playlist(raw)

    host = _host(raw)
    if not host:
        raise ValueError("That doesn't look like a link — paste a full URL")

    if host in spotify.HOSTS:
        return spotify.fetch_playlist(raw)
    if host in YOUTUBE_HOSTS:
        return resolve_youtube(raw)
    if host in apple_music.HOSTS:
        return apple_music.fetch(raw)
    if host in soundcloud.HOSTS:
        return soundcloud.fetch(raw)

    for prefix, name in UNREADABLE_HOSTS.items():
        if host == prefix or host.startswith(prefix + ".") or host.endswith("." + prefix):
            raise ValueError(
                f"{name} links can't be read — the song list only loads after signing in, inside "
                f"{name}'s own app, with nothing a browser or server can see from the outside. "
                "Try a Spotify, YouTube, Apple Music or SoundCloud link for this song instead."
            )

    return _generic_fallback(raw, host)
