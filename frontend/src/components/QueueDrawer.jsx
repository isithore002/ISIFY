import { Fragment, useState } from "react";
import { usePlayerStore } from "../store/playerStore";

function formatDuration(ms) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function QueueDrawer() {
  const store = usePlayerStore();
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  if (!store.isQueueOpen) return null;

  const currentTrack = store.currentTrack();
  const upcoming = store.upcomingTracks();

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Transparent or custom drag preview
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Left drag zone
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const actualFrom = store.currentIndex + 1 + draggedIndex;
    const actualTo = store.currentIndex + 1 + targetIndex;
    store.reorderQueue(actualFrom, actualTo);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (e, idx) => {
    e.stopPropagation();
    if (idx <= 0) return;
    const actualFrom = store.currentIndex + 1 + idx;
    store.reorderQueue(actualFrom, actualFrom - 1);
  };

  const handleMoveDown = (e, idx) => {
    e.stopPropagation();
    if (idx >= upcoming.length - 1) return;
    const actualFrom = store.currentIndex + 1 + idx;
    store.reorderQueue(actualFrom, actualFrom + 1);
  };

  const handleRemove = (e, idx) => {
    e.stopPropagation();
    const actualIndex = store.currentIndex + 1 + idx;
    store.removeFromQueue(actualIndex);
  };

  const handlePlayUpcoming = (idx) => {
    const actualIndex = store.currentIndex + 1 + idx;
    store.setTrack(actualIndex);
    store.setPlaying(true);
  };

  return (
    <aside className="queue-drawer">
      {/* Header */}
      <div className="queue-header">
        <div className="queue-header-titles">
          <h2 className="queue-title">Queue</h2>
          {store.contextName && (
            <span className="queue-context">
              Playing from: <strong>{store.contextName}</strong>
            </span>
          )}
        </div>
        <div className="queue-header-actions">
          {store.autoplayQueue && (
            <button
              className={`queue-autoplay-btn ${store.autoplayOn ? "on" : ""}`}
              onClick={store.toggleAutoplay}
              aria-pressed={store.autoplayOn}
              title={
                store.autoplayOn
                  ? "Autoplay is on: when the queue ends, songs like the last one keep playing"
                  : "Autoplay is off: playback stops when the queue ends"
              }
            >
              Autoplay {store.autoplayOn ? "on" : "off"}
            </button>
          )}
          {upcoming.length > 0 && (
            <button
              className="queue-clear-btn"
              onClick={store.clearUpcoming}
              title="Clear all upcoming tracks from queue"
            >
              Clear
            </button>
          )}
          <button
            className="queue-close-btn"
            onClick={() => store.setQueueOpen(false)}
            title="Close queue"
            aria-label="Close queue"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="queue-scroll-area">
        {/* Now Playing Section */}
        {currentTrack && (
          <div className="queue-section">
            <span className="queue-section-label">NOW PLAYING</span>
            <div
              className="now-playing-card"
              onClick={() => store.setPlaying(!store.playing)}
              title={store.playing ? "Click to pause" : "Click to play"}
            >
              <div className="now-playing-cover-wrap">
                {currentTrack.cover_url ? (
                  <img
                    src={currentTrack.cover_url}
                    alt={currentTrack.title}
                    className="now-playing-cover"
                  />
                ) : (
                  <div className="now-playing-cover now-playing-fallback">🎵</div>
                )}
                {store.playing && (
                  <div className="equalizer-overlay">
                    <span className="eq-bar eq-bar-1" />
                    <span className="eq-bar eq-bar-2" />
                    <span className="eq-bar eq-bar-3" />
                  </div>
                )}
              </div>
              <div className="now-playing-info">
                <span className="now-playing-title">{currentTrack.title}</span>
                <span className="now-playing-artist">{currentTrack.artist}</span>
                {currentTrack.album && (
                  <span className="now-playing-album">{currentTrack.album}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Next Up Section */}
        <div className="queue-section">
          <div className="queue-section-header">
            <span className="queue-section-label">
              NEXT UP {upcoming.length > 0 ? `(${upcoming.length})` : ""}
            </span>
            {upcoming.length > 1 && (
              <span className="queue-drag-hint">Drag or use arrows to reorder</span>
            )}
          </div>

          {upcoming.length === 0 ? (
            <div className="queue-empty-state">
              <span className="queue-empty-icon">🎶</span>
              {store.autoplayQueue && store.autoplayOn ? (
                <>
                  <p className="queue-empty-text">Finding songs like this one…</p>
                  <p className="queue-empty-subtext">
                    Autoplay lines up similar songs so the music keeps going.
                  </p>
                </>
              ) : (
                <>
                  <p className="queue-empty-text">No tracks up next</p>
                  <p className="queue-empty-subtext">
                    Add songs from any playlist using "Play next" or "Add to queue".
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="queue-list" onDragLeave={handleDragLeave}>
              {upcoming.map((track, idx) => {
                const isDragging = draggedIndex === idx;
                const isOver = dragOverIndex === idx;

                // Songs added by autoplay get their own heading where they begin
                const startsAutoplay = track.autoplay && !upcoming[idx - 1]?.autoplay;

                return (
                  <Fragment key={track.queueKey || `${track.id}-${idx}`}>
                  {startsAutoplay && (
                    <div className="queue-autoplay-label">Autoplay · songs like what you were playing</div>
                  )}
                  <div
                    className={`queue-item ${isDragging ? "dragging" : ""} ${isOver ? "drag-over" : ""}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handlePlayUpcoming(idx)}
                    title="Click to play now · Drag to reorder"
                  >
                    {/* Drag Handle */}
                    <div
                      className="queue-drag-handle"
                      title="Drag to reorder"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <circle cx="5" cy="4" r="1.5" />
                        <circle cx="11" cy="4" r="1.5" />
                        <circle cx="5" cy="8" r="1.5" />
                        <circle cx="11" cy="8" r="1.5" />
                        <circle cx="5" cy="12" r="1.5" />
                        <circle cx="11" cy="12" r="1.5" />
                      </svg>
                    </div>

                    {/* Reorder Up/Down arrows */}
                    <div className="queue-order-controls" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="order-btn"
                        onClick={(e) => handleMoveUp(e, idx)}
                        disabled={idx === 0}
                        title="Move up"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="order-btn"
                        onClick={(e) => handleMoveDown(e, idx)}
                        disabled={idx === upcoming.length - 1}
                        title="Move down"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Cover art */}
                    <div className="queue-item-art-wrap">
                      {track.cover_url ? (
                        <img
                          src={track.cover_url}
                          alt={track.title}
                          className="queue-item-art"
                        />
                      ) : (
                        <div className="queue-item-art queue-item-art-fallback">🎵</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="queue-item-info">
                      <span className="queue-item-title">{track.title}</span>
                      <span className="queue-item-artist">{track.artist}</span>
                    </div>

                    {/* Duration */}
                    <span className="queue-item-duration">
                      {formatDuration(track.duration_ms)}
                    </span>

                    {/* Remove button */}
                    <button
                      className="queue-item-remove"
                      onClick={(e) => handleRemove(e, idx)}
                      title="Remove from queue"
                      aria-label="Remove from queue"
                    >
                      ✕
                    </button>
                  </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
