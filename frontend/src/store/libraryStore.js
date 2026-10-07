import { create } from "zustand";

const STORAGE_KEY = "wv_playlists";

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(playlists) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {
    // storage full or blocked — the session still works, just won't be remembered
  }
}

// Playlists imported by URL (Spotify/YouTube/Apple Music/SoundCloud). Shared so both the
// sidebar and the empty-state's own import form add to the same remembered list.
export const useLibraryStore = create((set) => ({
  playlists: load(),

  add: (playlist) =>
    set((s) => {
      const playlists = [playlist, ...s.playlists.filter((p) => p.id !== playlist.id)];
      persist(playlists);
      return { playlists };
    }),

  remove: (id) =>
    set((s) => {
      const playlists = s.playlists.filter((p) => p.id !== id);
      persist(playlists);
      return { playlists };
    }),
}));
