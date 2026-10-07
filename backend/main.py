import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import playlist, track, search, bulk

app = FastAPI(title="ISIFY API", version="1.0.0")

origins = os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")

# Also accept pages opened from another device on the same network — but only from private
# address ranges, never an arbitrary website: this backend downloads audio for whoever can call it.
#   192.168.x.x / 10.x.x.x / 172.16–31.x.x   home and office networks
#   100.64–127.x.x, *.ts.net                  Tailscale (a private VPN between your own devices)
#   *.local                                   mDNS names such as my-pc.local
PRIVATE_ORIGIN_RE = (
    r"^https?://("
    r"localhost|127\.0\.0\.1|\[::1\]"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r"|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}"
    r"|[\w-]+\.local"
    r"|[\w.-]+\.ts\.net"
    r")(:\d+)?$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=PRIVATE_ORIGIN_RE,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(playlist.router)
app.include_router(track.router)
app.include_router(search.router)
app.include_router(bulk.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
