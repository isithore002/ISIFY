import { create } from 'zustand';

export const usePlayerStore = create((set, get) => ({
  queue: [],
  currentIndex: -1,
  playlistId: null,
  playing: false,
  progress: 0,
  duration: 0,
  volume: 1.0,
  sound: null,

  setQueue: (tracks, startIndex = 0, playlistId = null) =>
    set({ queue: tracks, currentIndex: startIndex, playlistId, progress: 0, duration: 0 }),

  setPlaying: (playing) => set({ playing }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setSound: (sound) => set({ sound }),

  next: () => {
    const { queue, currentIndex } = get();
    if (currentIndex < queue.length - 1) set({ currentIndex: currentIndex + 1 });
  },
  prev: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) set({ currentIndex: currentIndex - 1 });
  },

  currentTrack: () => {
    const { queue, currentIndex } = get();
    return currentIndex >= 0 ? queue[currentIndex] : null;
  },
}));
