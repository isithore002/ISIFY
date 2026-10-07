import api from "./client";

// Song/album/playlist link → track list, via the backend (Spotify, YouTube, Apple Music, SoundCloud)
export const importPlaylist = (url) =>
  api.post("/api/playlist", { url }).then((r) => r.data);

export const searchTracks = (q) =>
  api.get("/api/search", { params: { q } }).then((r) => r.data);
