import re
import shutil
import asyncio
import uuid
import zipfile
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from models.track import PrepareRequest
from services.prepare import prepare
from services.youtube import CACHE_DIR

router = APIRouter(prefix="/api/bulk", tags=["bulk"])

PARALLEL_DOWNLOADS = 3
ZIP_DIR = CACHE_DIR / "zips"
shutil.rmtree(ZIP_DIR, ignore_errors=True)  # jobs don't survive a restart, neither should their zips
ZIP_DIR.mkdir(parents=True, exist_ok=True)

# job_id → {"status", "name", "total", "done", "failed", "zip", "task"}
_jobs: dict[str, dict] = {}

_BAD_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


class BulkRequest(BaseModel):
    name: str = "WaveVault"
    tracks: list[PrepareRequest] = Field(min_length=1, max_length=1000)


def _safe_name(name: str) -> str:
    """Valid file/folder name on Windows, macOS and Linux."""
    name = _BAD_CHARS.sub("_", name).strip(" .")
    return name[:150] or "untitled"


def _write_zip(zip_path: Path, folder: str, files: list[tuple[Path, str]]) -> None:
    used: set[str] = set()
    tmp = zip_path.with_suffix(".part")
    # MP3s are already compressed — store them as-is
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
        for path, base in files:
            arc, n = base, 2
            while arc.lower() in used:
                arc, n = f"{base} ({n})", n + 1
            used.add(arc.lower())
            z.write(path, f"{folder}/{arc}.mp3")
    tmp.replace(zip_path)


async def _run(job_id: str, req: BulkRequest) -> None:
    job = _jobs[job_id]
    sem = asyncio.Semaphore(PARALLEL_DOWNLOADS)
    results: list[Path | None] = [None] * len(req.tracks)

    async def one(i: int, t: PrepareRequest) -> None:
        async with sem:
            try:
                results[i] = await prepare(t)
            except Exception as e:
                job["failed"].append({"title": f"{t.artist} - {t.title}", "error": str(e)})
            finally:
                job["done"] += 1

    try:
        await asyncio.gather(*(one(i, t) for i, t in enumerate(req.tracks)))
        width = len(str(len(req.tracks)))
        files = [
            (path, _safe_name(f"{i + 1:0{width}d} - {t.artist} - {t.title}"))
            for i, (t, path) in enumerate(zip(req.tracks, results))
            if path is not None
        ]
        if not files:
            job["status"] = "error"
            job["error"] = "No song could be downloaded"
            return
        zip_path = ZIP_DIR / f"{job_id}.zip"
        await asyncio.get_running_loop().run_in_executor(
            None, _write_zip, zip_path, _safe_name(req.name), files
        )
        job["zip"] = zip_path
        job["status"] = "ready"
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def _public(job_id: str, job: dict) -> dict:
    return {
        "job_id": job_id,
        "status": job["status"],  # "running" | "ready" | "error"
        "name": job["name"],
        "total": job["total"],
        "done": job["done"],
        "failed": job["failed"],
        "error": job.get("error"),
    }


def _get(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job")
    return job


@router.post("")
async def start_bulk_download(req: BulkRequest):
    """Start downloading every track; poll GET /api/bulk/{job_id}, then fetch /zip."""
    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"status": "running", "name": req.name, "total": len(req.tracks),
                     "done": 0, "failed": [], "zip": None}
    # Keep a reference so the task isn't garbage-collected mid-run
    _jobs[job_id]["task"] = asyncio.create_task(_run(job_id, req))
    return _public(job_id, _jobs[job_id])


@router.get("/{job_id}")
async def bulk_status(job_id: str):
    return _public(job_id, _get(job_id))


@router.get("/{job_id}/zip")
async def bulk_zip(job_id: str):
    job = _get(job_id)
    if job["status"] != "ready":
        raise HTTPException(status_code=409, detail=f"Job is {job['status']}")

    def cleanup():
        Path(job["zip"]).unlink(missing_ok=True)
        _jobs.pop(job_id, None)

    return FileResponse(
        path=str(job["zip"]),
        media_type="application/zip",
        filename=f"{_safe_name(job['name'])}.zip",
        background=BackgroundTask(cleanup),
    )
