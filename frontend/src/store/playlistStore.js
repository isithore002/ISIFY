import { create } from "zustand";

const STORAGE_KEY = "wv_user_playlists";

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(playlists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {
    // storage full or blocked — the session still works, it just won't be remembered
  }
}

const newId = () =>
  `pl_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 12)}`;

// Only what's needed to list and replay a song. Queue keys and play counts are per-session
// noise, and a local file's `File` object can't be saved at all.
const slim = (t) => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  album: t.album ?? "",
  duration_ms: t.duration_ms ?? 0,
  cover_url: t.cover_url ?? null,
  track_number: t.track_number ?? 0,
  yt_video_id: t.yt_video_id ?? null,
});

// The playlist's cover is the first cover among its songs, so it follows edits automatically
const withCover = (pl) => ({ ...pl, cover_url: pl.tracks.find((t) => t.cover_url)?.cover_url ?? null });

const update = (playlists, id, fn) => playlists.map((p) => (p.id === id ? withCover(fn(p)) : p));

export const usePlaylistStore = create((set, get) => ({
  playlists: load(),

  create: (name) => {
    const playlist = {
      id: newId(),
      kind: "user",
      name: name.trim() || "New playlist",
      description: "",
      owner: "You",
      cover_url: null,
      tracks: [],
    };
    const playlists = [playlist, ...get().playlists];
    persist(playlists);
    set({ playlists });
    return playlist;
  },

  rename: (id, name) => {
    const cleaned = name.trim();
    if (!cleaned) return;
    const playlists = update(get().playlists, id, (p) => ({ ...p, name: cleaned }));
    persist(playlists);
    set({ playlists });
  },

  remove: (id) => {
    const playlists = get().playlists.filter((p) => p.id !== id);
    persist(playlists);
    set({ playlists });
  },

  // → "added" | "duplicate" | "unsupported"
  addTrack: (id, track) => {
    if (track.file || track.local) return "unsupported"; // a local file can't be saved in a playlist
    const playlist = get().playlists.find((p) => p.id === id);
    if (!playlist) return "unsupported";
    if (playlist.tracks.some((t) => t.id === track.id)) return "duplicate";

    const playlists = update(get().playlists, id, (p) => ({ ...p, tracks: [...p.tracks, slim(track)] }));
    persist(playlists);
    set({ playlists });
    return "added";
  },

  removeTrack: (id, trackId) => {
    const playlists = update(get().playlists, id, (p) => ({
      ...p,
      tracks: p.tracks.filter((t) => t.id !== trackId),
    }));
    persist(playlists);
    set({ playlists });
  },
}));
