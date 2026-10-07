import { useState, useEffect, useRef } from "react";
import { usePlayerStore } from "../store/playerStore";
import { usePlayer } from "../hooks/usePlayer";
import { useLikeStore } from "../store/likeStore";
import { INITIAL_PLAYER_TRACK } from "../data/mockMusfluentData";
import NowPlayingSheet from "./NowPlayingSheet";

const isPhoneWidth = () => window.matchMedia("(max-width: 760px)").matches;

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Player() {
  const store = usePlayerStore();
  const { seek, handlePrev, handleNext } = usePlayer();
  const { isLiked, toggleLike } = useLikeStore();
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [expanded, setExpanded] = useState(false); // the phone's full-screen "Now Playing"

  // If no track selected yet, show the "Summer of Love" track from the screenshot
  const activeTrack = store.currentTrack() || INITIAL_PLAYER_TRACK;

  const currentSeconds = store.progress * (store.duration || 286);
  const totalSeconds = store.duration || 286;
  const elapsedStr = formatTime(currentSeconds);
  const durationStr = formatTime(totalSeconds);

  const liked = isLiked(activeTrack.id);
  // A song was chosen but hasn't started yet (looking it up / buffering)
  const isBuffering = store.loadState === "finding" || store.loadState === "loading";

  const handlePlayToggle = () => {
    if (!store.currentTrack()) {
      store.setQueue([INITIAL_PLAYER_TRACK], 0, null, "Featured");
      store.setPlaying(true);
    } else {
      store.setPlaying(!store.playing);
    }
  };

  // ── Lock-screen / notification controls (Media Session) ──────────────────────
  // Lets the phone show the song on its lock screen and notification shade, and pause / skip
  // from there or from headphone buttons — and tells the browser this is real media playback.
  const playbackRef = useRef({});
  useEffect(() => {
    playbackRef.current = { handlePrev, handleNext, seek }; // always the latest handlers
  });
  const currentTrack = store.currentTrack();
  const trackId = currentTrack?.queueKey;

  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = currentTrack
      ? new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || "",
          artwork: currentTrack.cover_url ? [{ src: currentTrack.cover_url, sizes: "512x512" }] : [],
        })
      : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  useEffect(() => {
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = store.playing ? "playing" : "paused";
  }, [store.playing]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (action, handler) => {
      try { ms.setActionHandler(action, handler); } catch { /* action not supported here */ }
    };
    set("play", () => usePlayerStore.getState().setPlaying(true));
    set("pause", () => usePlayerStore.getState().setPlaying(false));
    set("previoustrack", () => playbackRef.current.handlePrev());
    set("nexttrack", () => playbackRef.current.handleNext());
    set("seekto", (d) => {
      const dur = usePlayerStore.getState().duration;
      if (dur && d.seekTime != null) playbackRef.current.seek(d.seekTime / dur);
    });
    return () => ["play", "pause", "previoustrack", "nexttrack", "seekto"].forEach((a) => set(a, null));
  }, []);

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seek(ratio);
  };

  return (
    <>
    <div className={`player-bar-container ${currentTrack ? "" : "idle"}`}>
      {/* ── Glowing Top Progress Line ── */}
      <div
        className="player-top-progress"
        onClick={handleProgressClick}
        title={`Seek: ${elapsedStr} / ${durationStr}`}
      >
        <div
          className="player-progress-fill"
          style={{ width: `${Math.max(0.5, store.progress * 100)}%` }}
        >
          <span className="player-progress-glow-head" />
        </div>
      </div>

      <div className="player-main-bar">
        {/* ── Left: Track Info ── */}
        <div
          className="player-left"
          onClick={() => isPhoneWidth() && currentTrack && setExpanded(true)}
        >
          <div className="player-art-wrap">
            {activeTrack.cover_url ? (
              <img
                src={activeTrack.cover_url}
                alt={activeTrack.title}
                className="player-art"
              />
            ) : (
              <div className="player-art player-art-fallback" aria-hidden="true">🎵</div>
            )}
            {store.playing && <div className="art-glow-ring" />}
          </div>
          <div className="player-meta">
            <span className="player-title" title={activeTrack.title}>
              {activeTrack.title}
            </span>
            <span className="player-artist" title={activeTrack.artist}>
              {activeTrack.artist}
            </span>
          </div>
        </div>

        {/* ── Center: Control Buttons ── */}
        <div className="player-center">
          {/* Shuffle button */}
          <button
            className={`player-ctrl-btn ${store.shuffle ? "active" : ""}`}
            onClick={store.toggleShuffle}
            title={store.shuffle ? "Disable shuffle" : "Enable shuffle"}
            aria-label="Toggle shuffle"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.39a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356A2.25 2.25 0 0 1 11.16 4.5h1.949l-1.018 1.018a.75.75 0 0 0 1.06 1.06L15.939 3.75 13.151.922zM.39 3.5H0V2h.39a3.75 3.75 0 0 1 2.873 1.34L4.85 5.253a.75.75 0 1 1-1.15.962L2.102 4.31A2.25 2.25 0 0 0 .39 3.5zm10.77 7.253a.75.75 0 0 1 1.06 0l1.018 1.018h1.949a2.25 2.25 0 0 0 1.722-.81.75.75 0 1 1 1.15.963 3.75 3.75 0 0 1-2.872 1.346H13.23l-1.019 1.019a.75.75 0 1 1-1.06-1.06l2.788-2.788-2.789-2.788a.75.75 0 0 1 0-1.06z" />
            </svg>
            {store.shuffle && <span className="ctrl-active-dot" />}
          </button>

          {/* Previous button */}
          <button
            className="player-ctrl-btn"
            onClick={handlePrev}
            title="Previous (Restart if > 3s)"
            aria-label="Previous"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.74a.7.7 0 0 1 1.05.61v12.56a.7.7 0 0 1-1.05.61L4 9.15V14.3a.7.7 0 0 1-1.4 0V1.7A.7.7 0 0 1 3.3 1z" />
            </svg>
          </button>

          {/* Large Circular Neon Play/Pause Button */}
          <button
            className="player-play-btn"
            onClick={handlePlayToggle}
            title={store.playing ? "Pause" : "Play"}
            aria-label={store.playing ? "Pause" : "Play"}
            aria-busy={isBuffering}
          >
            {isBuffering ? (
              <span className="play-spinner" aria-hidden="true" />
            ) : store.playing ? (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="#000">
                <path d="M3 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2zm6 0a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V2z" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="#000" style={{ marginLeft: 2 }}>
                <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z" />
              </svg>
            )}
          </button>

          {/* Next button */}
          <button
            className="player-ctrl-btn"
            onClick={handleNext}
            title="Next"
            aria-label="Next"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.11A.7.7 0 0 0 1 1.72v12.56a.7.7 0 0 0 1.05.61L12 9.15V14.3a.7.7 0 0 0 1.4 0V1.7a.7.7 0 0 0-.7-.7z" />
            </svg>
          </button>

          {/* Repeat button */}
          <button
            className={`player-ctrl-btn ${store.repeat !== "off" ? "active" : ""}`}
            onClick={store.toggleRepeat}
            title={store.repeat === "one" ? "Turn off repeat" : "Repeat this song"}
            aria-label="Toggle repeat"
            aria-pressed={store.repeat === "one"}
          >
            {store.repeat === "one" ? (
              <div className="repeat-one-wrap">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5a.75.75 0 0 1 0 1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z" />
                </svg>
                <span className="repeat-one-number">1</span>
              </div>
            ) : (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5a.75.75 0 0 1 0 1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z" />
              </svg>
            )}
            {store.repeat !== "off" && <span className="ctrl-active-dot" />}
          </button>
        </div>

        {/* ── Right: Time Pill, Like, Volume, More ── */}
        <div className="player-right">
          {/* Time Capsule Pill */}
          <div className="time-capsule-pill">
            <span>{elapsedStr}</span>
            <span className="time-pill-divider">|</span>
            <span>{durationStr}</span>
          </div>

          {/* Like Heart Button */}
          <button
            className={`player-action-btn like-heart-btn ${liked ? "liked" : ""}`}
            onClick={() => toggleLike(activeTrack.id)}
            title={liked ? "Remove from Liked" : "Like song"}
          >
            {liked ? "♥" : "♡"}
          </button>

          {/* Volume Icon + Slider */}
          <div
            className="volume-control-wrap"
            onMouseEnter={() => setShowVolumePopup(true)}
            onMouseLeave={() => setShowVolumePopup(false)}
          >
            <button
              className="player-action-btn"
              onClick={store.toggleMute}
              title={store.volume === 0 ? "Unmute" : "Mute"}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                {store.volume === 0 ? (
                  <path d="M13.86 5.47a.75.75 0 0 0-1.06 0l-1.8 1.8-1.8-1.8A.75.75 0 0 0 8.14 6.53l1.8 1.8-1.8 1.8a.75.75 0 0 0 1.06 1.06l1.8-1.8 1.8 1.8a.75.75 0 0 0 1.06-1.06l-1.8-1.8 1.8-1.8a.75.75 0 0 0 0-1.06zM6 2.5a.75.75 0 0 0-.75.75v9.5c0 .64.73.99 1.22.58L9.75 10.5H12a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H9.75L6.47 2.67A.75.75 0 0 0 6 2.5zM2 6a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2.5V6H2z" />
                ) : (
                  <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-4.5-2.6V3.45l4.5-2.6a.75.75 0 0 1 .75 0zM3.5 4.5H1.5A1.5 1.5 0 0 0 0 6v4a1.5 1.5 0 0 0 1.5 1.5h2V4.5zm8.56 2.44a.75.75 0 0 1 1.06 0 2.25 2.25 0 0 1 0 3.18.75.75 0 0 1-1.06-1.06.75.75 0 0 0 0-1.06.75.75 0 0 1 0-1.06zm2.12-2.12a.75.75 0 0 1 1.06 0 5.25 5.25 0 0 1 0 7.42.75.75 0 1 1-1.06-1.06 3.75 3.75 0 0 0 0-5.3.75.75 0 0 1 0-1.06z" />
                )}
              </svg>
            </button>

            {/* Subtle Inline/Hover Volume Slider */}
            <div className={`volume-slider-box ${showVolumePopup ? "show" : ""}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={store.volume}
                onChange={(e) => store.setVolume(parseFloat(e.target.value))}
                className="mini-volume-bar"
                style={{
                  background: `linear-gradient(to right, #1ed760 ${store.volume * 100}%, #2e3042 ${store.volume * 100}%)`,
                }}
              />
            </div>
          </div>

          {/* More options / Queue toggle button */}
          <button
            className={`player-action-btn ${store.isQueueOpen ? "active" : ""}`}
            onClick={store.toggleQueue}
            title={store.isQueueOpen ? "Close Queue" : "Open Queue"}
          >
            ⋯
          </button>
        </div>
      </div>
    </div>

    <NowPlayingSheet
      isOpen={expanded}
      onClose={() => setExpanded(false)}
      track={currentTrack}
      onSeek={seek}
      onPrev={handlePrev}
      onNext={handleNext}
      onToggle={handlePlayToggle}
    />
    </>
  );
}
