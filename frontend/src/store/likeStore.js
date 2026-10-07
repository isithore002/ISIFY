import { create } from "zustand";

const STORAGE_KEY = "wv_liked_songs";

function loadLikes() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '["track-summer-of-love", "trendy-2"]'));
  } catch {
    return new Set(["track-summer-of-love", "trendy-2"]);
  }
}

function persistLikes(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export const useLikeStore = create((set, get) => ({
  likedIds: loadLikes(),

  isLiked: (trackId) => get().likedIds.has(trackId),

  toggleLike: (trackId) => {
    set((state) => {
      const next = new Set(state.likedIds);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      persistLikes(next);
      return { likedIds: next };
    });
  },
}));
