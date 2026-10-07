from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.resolver import resolve
from models.track import PlaylistMeta

router = APIRouter(prefix="/api/playlist", tags=["playlist"])


class PlaylistRequest(BaseModel):
    url: str


# Plain `def`: the importers use blocking HTTP / yt-dlp calls, so FastAPI runs this in its threadpool
@router.post("", response_model=PlaylistMeta)
def import_playlist(body: PlaylistRequest):
    try:
        return resolve(body.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
