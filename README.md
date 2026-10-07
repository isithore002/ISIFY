# ISIFY

Modern dark neon music streaming player and downloader: search any song on YouTube, paste a song, album or playlist link from Spotify,
YouTube, Apple Music or SoundCloud, and ISIFY streams it instantly, downloads each one
(directly from YouTube), converts it to a tagged MP3 with cover art, and lets you play it or save it — one song at a
time or the whole playlist as a ZIP.

| Platform | Songs/lists read | Notes |
|---|---|---|
| Spotify | track, album, playlist | Web API when available, else the public embed page (100-song cap, no login needed) |
| YouTube | video, playlist | Downloads the exact video — no search matching |
| Apple Music | song, album, playlist | Read from the page directly, no API |
| SoundCloud | track | Playlists ("sets") aren't supported yet |
| Amazon Music, Deezer | — | Not possible: no song data is available without signing into their app |
| anything else | — | Best-effort, if the page sets standard sharing/preview tags |

```
backend/   FastAPI — playlist import, YouTube download + ID3 tagging, MP3 serving
frontend/  React + Vite web app — library, player, offline cache
mobile/    Expo (SDK 52) app — import by URL, player, offline downloads
```

There's no login — every link is read anonymously (Spotify's app-only token, or each
platform's own public page/API), so private playlists on any platform can't be imported.

## Requirements

- Python 3.11, Node 20+
- FFmpeg: bundled via the `imageio-ffmpeg` pip package; a system install on PATH is used first if present
- Node.js (or Deno): yt-dlp needs a JavaScript runtime for YouTube
- Optional — a Spotify app from <https://developer.spotify.com/dashboard>, only to raise
  Spotify playlists past the public embed page's 100-song cap
  - While the app is in Development Mode, Spotify requires the app owner's account to have
    an active **Premium** subscription; without it the Web API returns 403 and imports fall
    back to the embed page.

## Backend

```sh
cd backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env         # fill in SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
uvicorn main:app --host 127.0.0.1 --port 8000
```

(`--reload` can hang on Windows while a download is running; restart manually after code changes.)

Use `--host 0.0.0.0` instead when the mobile app needs to reach it over Wi-Fi.

| Endpoint | Purpose |
|---|---|
| `POST /api/playlist` | Import a playlist / album / track link (Web API, else embed page) |
| `POST /api/track/play` | Start a song fast: cached MP3 if there is one, otherwise a live stream (see below) |
| `GET /api/track/{id}/live` | The live audio stream (supports Range / seeking); call `/play` first |
| `POST /api/track/warm` | Look up songs ahead of time (hover, next in queue) so playing them is near-instant |
| `POST /api/track/prepare` | Download + tag a track if not cached yet |
| `GET /api/track/{id}/file` | Serve a cached MP3 (supports Range / seeking) |
| `POST /api/track/{id}/download` | Prepare, then return as an attachment |
| `GET /api/track/{id}/status` | `ready` / `pending` / `not_found` |
| `POST /api/bulk` | Start downloading a list of tracks; returns a `job_id` |
| `GET /api/bulk/{job_id}` | Progress: `done` / `total` / `failed` |
| `GET /api/bulk/{job_id}/zip` | The finished ZIP (deleted from the server after download) |
| `GET /api/search?q=&n=&songs_only=` | YouTube search (top 5 by default; `n` up to 30, `songs_only` drops clips and hour-long mixes) |
| `GET /api/search/similar?video_id=` | Songs like a YouTube video (its YouTube Mix), used by autoplay |

### How playback stays fast

Playing a song used to wait for the whole download → MP3 conversion → tagging pipeline
(roughly 9–14 s). Now:

- **Cached MP3** on disk → starts in about 0.1 s.
- **Not cached** → the backend resolves a direct audio URL and **streams it live**, so sound
  starts in about 3 s (mostly YouTube's own response time). The MP3 is cached in the
  background afterwards, 30 s in, so it never competes with the stream you're listening to.
- **Warmed** → songs are looked up ahead of time when you rest the pointer on them, when a
  playlist opens, and for the next song in the queue. The start of the audio is fetched too,
  so playing a warmed song begins in about 0.1 s.
- Each song's YouTube match is remembered (`cache/video_ids.json`), so it is searched for once.

### Genres (Tamil and English)

**Browse by Genre** on the Discover page (the sidebar's *Genres* item jumps to it) has a Tamil /
English switch over a grid of genre cards — Tamil: Kuthu, Melody, Love, Sad & Feel, Mass, 90s, Folk
& Gaana, Rap, Party, Devotional, plus composers (A.R. Rahman, Ilaiyaraaja, Anirudh, Yuvan…);
English: Pop, Hip-Hop, Rock, R&B, EDM, Indie, Country, Jazz, Chill, Latin, Metal, decades…
A card searches YouTube for that genre (up to 25 individual songs, no compilations) and opens them
as a page; picking a song plays it and queues the rest of the genre, then autoplay (below) carries
on with similar songs. Genres are defined in `frontend/src/data/genres.js` — add a card by adding
a line with a name, emoji, colour and search query.

### Autoplay (songs like the last one)

Playing a song from search plays just that song, then keeps going with songs like it — taken from
YouTube's own Mix for that video (same artist, era and style). They are fetched as soon as the song
starts, so they're already in the queue (under an "Autoplay" heading) by the time it ends, and
fetched again from the last one whenever the queue runs out. It can be switched off with the
"Autoplay" chip in the Queue drawer (remembered), and it only applies to songs started from
search — playlists and albums still simply end. **Repeat** is separate: it just replays the
current song.

## Web

```sh
cd frontend
npm install
copy .env.example .env
npm run dev                    # http://127.0.0.1:5173
```

**Local music:** "Add folder" / "Open files" in the sidebar play songs straight from your
disk (MP3, M4A, AAC, FLAC, WAV, OGG, Opus), reading title/artist/album/cover from the tags.
In Chrome/Edge added folders are remembered (the browser asks for read access again after
a restart); other browsers keep them for the current session only. Nothing is uploaded.

## Use it from your phone or another device

Both servers listen on every network interface, so any device on the same Wi-Fi can open the
app at `http://<this-pc's-ip>:5173` (find the IP with `ipconfig`, the "IPv4 Address" of your
Wi-Fi adapter). The page works out where the backend is from the address it was opened at.
The address changes whenever the PC joins a different network (home router, hotspot, campus
Wi-Fi…), so re-check it with `ipconfig` — and the phone must be on that same network.

The phone gets its own layout (≤760px wide): a bottom tab bar (Home / Search / Library / Add), a
floating mini player that expands into a full-screen Now Playing screen, and bottom-sheet menus.
Lock-screen controls (play/pause/next/previous/seek) work through the Media Session API. If audio
misbehaves on one device, open the app with `?debug` on the end of the address for an on-screen
log of playback events (`?nodebug` turns it off again).

```sh
# backend (note --host 0.0.0.0, not 127.0.0.1)
cd backend && venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000
# frontend
cd frontend && npm run dev
```

Windows blocks incoming connections by default, so allow these two ports once. Run one of
these **as administrator** (right-click → Run as administrator); the `LocalSubnet` part keeps
it to devices on your own network. The first is PowerShell syntax, the second is for Command
Prompt — pasting PowerShell commands into Command Prompt fails with "not recognized".

```powershell
# PowerShell
New-NetFirewallRule -DisplayName "ISIFY dev (LAN only)" -Direction Inbound -Protocol TCP -LocalPort 5173,8000 -Action Allow -Profile Any -RemoteAddress LocalSubnet
# to undo:  Remove-NetFirewallRule -DisplayName "ISIFY dev (LAN only)"
```

```bat
:: Command Prompt
netsh advfirewall firewall add rule name="ISIFY dev (LAN only)" dir=in action=allow protocol=TCP localport=5173,8000 remoteip=localsubnet profile=any
:: to undo:  netsh advfirewall firewall delete rule name="ISIFY dev (LAN only)"
```

Notes: only do this on a network you trust (the backend downloads audio for anyone who can
reach it and has no login). The address can change when the router hands out a new one. Away
from home, use [Tailscale](https://tailscale.com) on the PC and phone instead of opening the
PC to the internet — the backend already accepts Tailscale addresses.

## Mobile

```sh
cd mobile
npm install
npx expo start
```

The app talks to the backend on the same host as the Metro dev server, port 8000
(see `src/config.js`), so the phone and PC must be on the same network — or use
`adb reverse tcp:8000 tcp:8000`.
