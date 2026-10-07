import { create } from "zustand";
import { fetchSimilarTracks } from "../api/search";

const AUTOPLAY_KEY = "wv_autoplay";
const LISTEN_TIME_KEY = "wv_total_listen_ms";
function loadAutoplayPref() {
  try { return localStorage.getItem(AUTOPLAY_KEY) !== "off"; } catch { return true; }
}

function loadListenTimeMs() {
  try {
    const raw = Number(localStorage.getItem(LISTEN_TIME_KEY) || "0");
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
}

function persistListenTimeMs(totalMs) {
  try {
    localStorage.setItem(LISTEN_TIME_KEY, String(totalMs));
  } catch {
    // not remembered if storage is blocked
  }
}

let upNext = null; // { key, promise }: the similar-songs lookup in flight, shared by callers asking about the same song

function generateQueueKey(track) {
  return `${track.id || "track"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withQueueKeys(tracks) {
  return tracks.map((t) => (t.queueKey ? t : { ...t, queueKey: generateQueueKey(t) }));
}

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const usePlayerStore = create((set, get) => ({
  queue: [],           // TrackMeta[] with queueKey
  originalQueue: [],   // Pristine playlist tracks order (before shuffle)
  currentIndex: -1,
  playlistId: null,
  contextName: "",     // "Playing from: ..." e.g. "Summer Hits"
  playing: false,
  progress: 0,         // 0-1
  duration: 0,
  volume: 0.8,
  previousVolume: 0.8,
  loadState: "idle",   // "finding" | "loading" | "error" | "idle"
  loadError: null,

  // Spotify features
  shuffle: false,
  repeat: "off",       // "off" | "one" (replay the current song; never the playlist)
  isQueueOpen: false,
  toast: null,

  // Autoplay: when a song started from search reaches the end of the queue, keep going with
  // songs like the last one instead of stopping. Two switches must both be on: the user's own
  // (Queue drawer, remembered) and whether this queue came from a search.
  autoplayOn: loadAutoplayPref(),
  autoplayQueue: false,
  queueEpoch: 0,       // bumps whenever a brand-new queue replaces the old one
  totalListenMs: loadListenTimeMs(),

  showToast: (message) => {
    const id = Date.now();
    set({ toast: { message, id } });
    // Short confirmations vanish quickly; longer messages (errors especially) get roughly
    // the time it takes to read them instead of a flat 2.4s.
    const visibleMs = Math.min(7000, 2400 + String(message).length * 30);
    setTimeout(() => {
      const current = get().toast;
      if (current?.id === id) {
        set({ toast: null });
      }
    }, visibleMs);
  },

  setQueue: (rawTracks, startIndex = 0, playlistId = null, contextName = "", { autoplay = false } = {}) => {
    const tracks = withQueueKeys(rawTracks);
    const { shuffle, queueEpoch } = get();
    const fresh = { autoplayQueue: autoplay, queueEpoch: queueEpoch + 1 };

    if (shuffle && tracks.length > 1) {
      // Current track stays at start (or selected startIndex)
      const currentTrack = tracks[startIndex];
      const remainingTracks = tracks.filter((_, idx) => idx !== startIndex);
      const shuffled = shuffleArray(remainingTracks);
      const newQueue = [currentTrack, ...shuffled];
      set({
        ...fresh,
        queue: newQueue,
        originalQueue: tracks,
        currentIndex: 0,
        playlistId,
        contextName: contextName || (playlistId ? "Playlist" : "Queue"),
      });
    } else {
      set({
        ...fresh,
        queue: tracks,
        originalQueue: tracks,
        currentIndex: startIndex,
        playlistId,
        contextName: contextName || (playlistId ? "Playlist" : "Queue"),
      });
    }
  },

  // A song picked from search results plays on its own; what follows is chosen by autoplay
  // (songs like it), not by whatever else happened to be in the results list.
  playFromSearch: (track, query) => {
    get().setQueue([track], 0, null, `YouTube: ${query}`, { autoplay: true });
    set({ playing: true });
  },

  toggleAutoplay: () => {
    const autoplayOn = !get().autoplayOn;
    set({ autoplayOn });
    try { localStorage.setItem(AUTOPLAY_KEY, autoplayOn ? "on" : "off"); } catch { /* not remembered */ }
    get().showToast(autoplayOn ? "Autoplay on — similar songs keep playing" : "Autoplay off");
    if (autoplayOn) get().ensureUpNext();
  },

  addListenTimeMs: (ms) => {
    if (!ms || ms <= 0) return;
    set((state) => {
      const totalListenMs = state.totalListenMs + ms;
      persistListenTimeMs(totalListenMs);
      return { totalListenMs };
    });
  },

  // If the song now playing is the last one in the queue and autoplay applies, fetch songs like
  // it and add them after it. Resolves true when songs were added. Called as each song starts
  // (so the answer is ready long before the song ends) and again at the very end as a backstop.
  ensureUpNext: () => {
    const { autoplayOn, autoplayQueue, queue, currentIndex, queueEpoch } = get();
    const seed = queue[currentIndex];
    if (!autoplayOn || !autoplayQueue || !seed?.yt_video_id || currentIndex < queue.length - 1) {
      return Promise.resolve(false);
    }
    const key = `${queueEpoch}:${seed.queueKey}`;
    if (upNext?.key === key) return upNext.promise;

    const promise = fetchSimilarTracks(seed.yt_video_id)
      .then((found) => {
        const s = get();
        // The queue moved on while we were asking (new queue, or songs were added after this
        // one) — these suggestions would be stale
        if (s.queueEpoch !== queueEpoch || s.queue[s.queue.length - 1]?.queueKey !== seed.queueKey) return false;

        const known = new Set(s.queue.flatMap((t) => [t.id, t.yt_video_id]));
        const added = withQueueKeys(
          found.filter((t) => !known.has(t.id) && !known.has(t.yt_video_id)).map((t) => ({ ...t, autoplay: true }))
        );
        if (!added.length) return false;
        set({ queue: [...s.queue, ...added], originalQueue: [...s.originalQueue, ...added] });
        return true;
      })
      .catch(() => false)
      .finally(() => { if (upNext?.key === key) upNext = null; });
    upNext = { key, promise };
    return promise;
  },

  // "Shuffle play" on a playlist: turns shuffle on and starts from a random song, rather than
  // always from track 1 followed by a shuffled remainder.
  playShuffled: (rawTracks, playlistId = null, contextName = "") => {
    if (!rawTracks.length) return;
    set({ shuffle: true });
    const start = Math.floor(Math.random() * rawTracks.length);
    get().setQueue(rawTracks, start, playlistId, contextName);
    set({ playing: true });
  },

  setTrack: (index) => set({ currentIndex: index }),
  setPlaying: (playing) => set({ playing }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => {
    const { volume, previousVolume } = get();
    if (volume > 0) {
      set({ previousVolume: volume, volume: 0 });
    } else {
      set({ volume: previousVolume > 0 ? previousVolume : 0.8 });
    }
  },
  setLoadState: (loadState, loadError = null) => set({ loadState, loadError }),
  setQueueOpen: (isQueueOpen) => set({ isQueueOpen }),
  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen })),

  toggleShuffle: () => {
    const { shuffle, queue, currentIndex, originalQueue } = get();
    const nextShuffle = !shuffle;

    // Nothing to rearrange: an empty or one-song queue, or no current song to keep in place
    // (slicing around index -1 would silently cut the wrong tracks out of the queue)
    if (queue.length <= 1 || currentIndex < 0) {
      set({ shuffle: nextShuffle });
      get().showToast(nextShuffle ? "Shuffle on" : "Shuffle off");
      return;
    }

    if (nextShuffle) {
      // Turning shuffle ON: keep current track, shuffle upcoming tracks
      const currentTrack = queue[currentIndex];
      const played = queue.slice(0, currentIndex);
      const upcoming = queue.slice(currentIndex + 1);
      const shuffledUpcoming = shuffleArray(upcoming);

      const newQueue = [...played, currentTrack, ...shuffledUpcoming];
      set({
        shuffle: true,
        queue: newQueue,
        originalQueue: originalQueue.length ? originalQueue : queue,
      });
      get().showToast("Shuffle on");
    } else {
      // Turning shuffle OFF: restore original order of upcoming tracks
      const currentTrack = queue[currentIndex];
      const played = queue.slice(0, currentIndex);

      const playedKeys = new Set([...played, currentTrack].map((t) => t.queueKey || t.id));
      const originalUpcoming = originalQueue.filter((t) => !playedKeys.has(t.queueKey || t.id));
      const extraTracks = queue.slice(currentIndex + 1).filter(
        (t) => !originalQueue.some((ot) => (ot.queueKey || ot.id) === (t.queueKey || t.id))
      );

      const restoredUpcoming = [...originalUpcoming, ...extraTracks];
      const newQueue = [...played, currentTrack, ...restoredUpcoming];

      set({
        shuffle: false,
        queue: newQueue,
      });
      get().showToast("Shuffle off");
    }
  },

  // Repeat only ever means "keep replaying this song" — it never loops the playlist
  toggleRepeat: () => {
    const nextRepeat = get().repeat === "one" ? "off" : "one";
    set({ repeat: nextRepeat });
    get().showToast(nextRepeat === "one" ? "Repeating this song" : "Repeat off");
  },

  next: () => {
    const { queue, currentIndex } = get();
    if (currentIndex < queue.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prev: () => {
    const { currentIndex, progress, duration } = get();
    const elapsed = progress * duration;

    // Restart track if more than 3 seconds in
    if (elapsed > 3) {
      set({ progress: 0 });
      return { restart: true };
    }

    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      return { restart: false };
    } else {
      set({ progress: 0 });
      return { restart: true };
    }
  },

  playNext: (track) => {
    const { queue, currentIndex, originalQueue } = get();
    const trackWithKey = { ...track, queueKey: generateQueueKey(track) };

    if (queue.length === 0 || currentIndex === -1) {
      set({
        queue: [trackWithKey],
        originalQueue: [trackWithKey],
        currentIndex: 0,
        playing: true,
        contextName: "Queue",
        autoplayQueue: false,
        queueEpoch: get().queueEpoch + 1,
      });
    } else {
      const newQueue = [
        ...queue.slice(0, currentIndex + 1),
        trackWithKey,
        ...queue.slice(currentIndex + 1),
      ];
      set({
        queue: newQueue,
        originalQueue: [...originalQueue, trackWithKey],
      });
    }
    get().showToast(`Playing next: ${track.title}`);
  },

  addToQueue: (track) => {
    const { queue, currentIndex, originalQueue } = get();
    const trackWithKey = { ...track, queueKey: generateQueueKey(track) };

    if (queue.length === 0 || currentIndex === -1) {
      set({
        queue: [trackWithKey],
        originalQueue: [trackWithKey],
        currentIndex: 0,
        playing: true,
        contextName: "Queue",
        autoplayQueue: false,
        queueEpoch: get().queueEpoch + 1,
      });
    } else {
      const newQueue = [...queue, trackWithKey];
      set({
        queue: newQueue,
        originalQueue: [...originalQueue, trackWithKey],
      });
    }
    get().showToast(`Added to queue: ${track.title}`);
  },

  removeFromQueue: (queueIndex) => {
    const { queue, currentIndex } = get();
    if (queueIndex < 0 || queueIndex >= queue.length) return;

    const removedTrack = queue[queueIndex];
    const newQueue = queue.filter((_, idx) => idx !== queueIndex);

    if (newQueue.length === 0) {
      set({ queue: [], currentIndex: -1, playing: false });
      return;
    }

    let newCurrent = currentIndex;
    if (queueIndex < currentIndex) {
      newCurrent = currentIndex - 1;
    } else if (queueIndex === currentIndex) {
      newCurrent = Math.min(currentIndex, newQueue.length - 1);
    }

    set({ queue: newQueue, currentIndex: newCurrent });
    get().showToast(`Removed from queue: ${removedTrack.title}`);
  },

  reorderQueue: (fromIndex, toIndex) => {
    const { queue, currentIndex } = get();
    if (
      fromIndex < 0 || fromIndex >= queue.length ||
      toIndex < 0 || toIndex >= queue.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, moved);

    let newCurrent = currentIndex;
    if (currentIndex === fromIndex) {
      newCurrent = toIndex;
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      newCurrent = currentIndex - 1;
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      newCurrent = currentIndex + 1;
    }

    set({ queue: newQueue, currentIndex: newCurrent });
  },

  clearUpcoming: () => {
    const { queue, currentIndex } = get();
    if (currentIndex === -1 || queue.length === 0) return;

    const newQueue = queue.slice(0, currentIndex + 1);
    set({ queue: newQueue });
    get().showToast("Upcoming queue cleared");
  },

  currentTrack: () => {
    const { queue, currentIndex } = get();
    return currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;
  },

  upcomingTracks: () => {
    const { queue, currentIndex } = get();
    if (currentIndex < 0 || currentIndex >= queue.length - 1) return [];
    return queue.slice(currentIndex + 1);
  },
}));
