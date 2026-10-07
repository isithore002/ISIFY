import re
import json
import html
import httpx
from models.track import TrackMeta, PlaylistMeta
from services.ids import stable_id

HOSTS = {"music.apple.com"}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36",
    "Accept-Language": "en",
}
# Apple Music embeds its own page data as JSON — same idea as Spotify's __NEXT_DATA__
_DATA_RE = re.compile(r'<script type="application/json" id="serialized-server-data"[^>]*>(.*?)</script>', re.S)
_OG_TITLE_RE = re.compile(r'<meta property="og:title" content="([^"]*)"')
_OG_DESC_RE = re.compile(r'<meta property="og:description" content="([^"]*)"')
_OG_IMAGE_RE = re.compile(r'<meta property="og:image" content="([^"]*)"')
_OG_TYPE_RE = re.compile(r'<meta property="og:type" content="([^"]*)"')
_TITLE_BY_RE = re.compile(r"^(.+) by (.+) on Apple Music$")
_DURATION_RE = re.compile(r"Duration (\d+):(\d\d)")


def _get(url: str) -> str:
    r = httpx.get(url, headers=_HEADERS, timeout=15, follow_redirects=True)
    if r.status_code == 404:
        raise ValueError("Apple Music page not found (is the link correct?)")
    r.raise_for_status()
    return r.text


def _og(text: str, pattern: re.Pattern) -> str | None:
    m = pattern.search(text)
    if not m:
        return None
    # Apple renders "Apple\xa0Music" with a non-breaking space, which broke a plain-space regex
    return html.unescape(m.group(1)).replace("\xa0", " ")


def _art_url(dictionary: dict | None, size: int = 640) -> str | None:
    tmpl = (dictionary or {}).get("url")
    if not tmpl:
        return None
    return tmpl.replace("{w}", str(size)).replace("{h}", str(size)).replace("{f}", "jpg")


def _song_items(sections: list[dict]) -> list[dict]:
    """Every song row across all tracklist sections (deluxe albums list 2 editions on one page)."""
    items, seen = [], set()
    for sec in sections:
        for it in sec.get("items") or []:
            cd = it.get("contentDescriptor") or {}
            sid = (cd.get("identifiers") or {}).get("storeAdamID")
            if cd.get("kind") == "song" and it.get("duration") and sid not in seen:
                seen.add(sid)
                items.append(it)
    return items


def _from_song_item(it: dict, index: int, fallback_album: str, fallback_cover: str | None) -> TrackMeta:
    sid = (it.get("contentDescriptor") or {}).get("identifiers", {}).get("storeAdamID") or str(index)
    tl = it.get("tertiaryLinks") or []
    return TrackMeta(
        id=stable_id("am", str(sid)),
        title=it.get("title") or "Unknown title",
        artist=it.get("artistName") or "Unknown artist",
        album=(tl[0].get("title") if tl else None) or fallback_album,
        duration_ms=it.get("duration") or 0,
        # Album tracklists carry no per-track artwork; playlists usually do
        cover_url=_art_url((it.get("artwork") or {}).get("dictionary")) or fallback_cover,
        track_number=it.get("trackNumber") or index + 1,
    )


def _from_og_song(text: str, url: str) -> PlaylistMeta:
    title_line = _og(text, _OG_TITLE_RE) or ""
    m = _TITLE_BY_RE.match(title_line)
    title, artist = (m.group(1), m.group(2)) if m else (title_line or "Unknown title", "Unknown artist")

    duration_ms = 0
    if dm := _DURATION_RE.search(_og(text, _OG_DESC_RE) or ""):
        duration_ms = (int(dm.group(1)) * 60 + int(dm.group(2))) * 1000

    track = TrackMeta(id=stable_id("am", url), title=title, artist=artist, album="",
                      duration_ms=duration_ms, cover_url=_og(text, _OG_IMAGE_RE))
    return PlaylistMeta(id=track.id, name=track.title, cover_url=track.cover_url,
                        owner=track.artist, tracks=[track])


def fetch(url: str) -> PlaylistMeta:
    text = _get(url)
    og_type = _og(text, _OG_TYPE_RE) or ""

    if og_type == "music.song":
        return _from_og_song(text, url)
    if og_type not in ("music.album", "music.playlist"):
        raise ValueError("That doesn't look like an Apple Music song, album or playlist link")

    m = _DATA_RE.search(text)
    if not m:
        raise RuntimeError("Apple Music page changed format — couldn't find track data")
    try:
        page = json.loads(m.group(1))["data"][0]["data"]
        items = _song_items(page["sections"])
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError("Apple Music page changed format — couldn't find track data") from e
    if not items:
        raise ValueError("No songs found on that Apple Music page")

    title_line = _og(text, _OG_TITLE_RE) or ""
    m2 = _TITLE_BY_RE.match(title_line)
    if m2:
        name, owner = m2.group(1), m2.group(2)
    else:
        name, owner = re.sub(r" on Apple Music$", "", title_line) or "Apple Music", "Apple Music"
    album_name = name if og_type == "music.album" else ""
    cover = _og(text, _OG_IMAGE_RE)

    tracks = [_from_song_item(it, i, album_name, cover) for i, it in enumerate(items)]
    return PlaylistMeta(id=stable_id("am", url), name=name, cover_url=cover, owner=owner, tracks=tracks)
