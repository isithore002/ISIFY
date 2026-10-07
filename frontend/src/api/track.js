import api from "./client";

// Backend request body for anything that may need to download + tag the track
export const prepareBody = (track) => ({
  track_id: track.id,
  title: track.title,
  artist: track.artist,
  album: track.album,
  track_number: track.track_number ?? 0,
  duration_ms: track.duration_ms ?? 0,
  cover_url: track.cover_url ?? null,
  yt_video_id: track.yt_video_id ?? null,
});

export const prepareTrack = (track) =>
  api.post(`/api/track/prepare`, prepareBody(track)).then((r) => r.data);

// Seekable (Range-capable) URL of a track the backend has already prepared
export const trackFileUrl = (trackId) => `${api.defaults.baseURL}/api/track/${trackId}/file`;

const absolute = (path) => (path.startsWith("http") ? path : `${api.defaults.baseURL}${path}`);

// Fastest way to start a song. Returns { url, format, source }: a cached MP3 ("cache"), or
// a live stream ("live") that begins playing about a second after it's resolved — without
// waiting for the download → convert → tag pipeline that `prepareTrack` runs to completion.
export const getPlaySource = (track) =>
  api.post("/api/track/play", prepareBody(track)).then((r) => ({ ...r.data, url: absolute(r.data.url) }));

// Ask the backend to get songs ready before they're played. cache:true also downloads them
// in the background so the next play comes straight from disk.
export const warmTracks = (tracks, { cache = false } = {}) =>
  api.post("/api/track/warm", { tracks: tracks.map(prepareBody), cache }).then((r) => r.data);

// Hover-intent warm-up: a pointer that rests on a song for a moment usually means a click is
// coming, so start resolving it now. Each song is warmed at most once per page load.
// Timers live at module level, keyed by song, so the returned handlers hold no state of their
// own and can be created fresh on every render.
const warmed = new Set();
const hoverTimers = new Map();
export function warmOnHover(track) {
  return {
    onMouseEnter: () => {
      if (track.local || track.file || warmed.has(track.id)) return;
      hoverTimers.set(
        track.id,
        setTimeout(() => {
          warmed.add(track.id);
          warmTracks([track]).catch(() => warmed.delete(track.id));
        }, 250),
      );
    },
    onMouseLeave: () => {
      clearTimeout(hoverTimers.get(track.id));
      hoverTimers.delete(track.id);
    },
  };
}

export const fetchTrackBlob = (trackId) =>
  api.get(`/api/track/${trackId}/file`, { responseType: "blob" }).then((r) => r.data);

// Reads a usable message out of any track-API error. Needed because two things make the
// obvious `err.response?.data?.detail` unreliable here: download/cache calls use
// responseType:"blob", so a failure response body arrives as an unparsed Blob instead of
// JSON; and FastAPI validation errors (422s) give `detail` as an array of objects, not a
// string, which would render as "[object Object]" (or crash) if shown directly.
export async function trackErrorMessage(err) {
  let detail = err.response?.data;
  if (detail instanceof Blob) {
    try {
      detail = JSON.parse(await detail.text()).detail;
    } catch {
      detail = undefined;
    }
  } else {
    detail = detail?.detail;
  }
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  if (typeof detail === "string") return detail;
  return err.message || "Something went wrong";
}

export const downloadTrack = async (track) => {
  const res = await api.post(
    `/api/track/${track.id}/download`,
    prepareBody(track),
    { responseType: "blob" }
  );
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${track.artist} - ${track.title}.mp3`;
  a.click();
  // Revoking synchronously can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
