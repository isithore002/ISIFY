import httpx
from pathlib import Path
from mutagen.id3 import (
    ID3,
    TIT2,
    TPE1,
    TALB,
    TRCK,
    APIC,
    ID3NoHeaderError,
)


async def embed_tags(
    mp3_path: Path,
    title: str,
    artist: str,
    album: str,
    track_number: int = 0,
    cover_url: str | None = None,
) -> None:
    try:
        tags = ID3(str(mp3_path))
    except ID3NoHeaderError:
        tags = ID3()

    tags[TIT2.__name__] = TIT2(encoding=3, text=title)
    tags[TPE1.__name__] = TPE1(encoding=3, text=artist)
    if album:
        tags[TALB.__name__] = TALB(encoding=3, text=album)
    if track_number:
        tags[TRCK.__name__] = TRCK(encoding=3, text=str(track_number))

    if cover_url:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(cover_url)
            if r.status_code == 200:
                tags[APIC.__name__] = APIC(
                    encoding=3,
                    mime="image/jpeg",
                    type=3,
                    desc="Cover",
                    data=r.content,
                )
        except Exception:
            pass

    tags.save(str(mp3_path))
