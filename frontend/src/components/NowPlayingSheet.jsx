import { useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useLikeStore } from "../store/likeStore";
import {
  ChevronDownIcon,
  QueueListIcon,
  HeartIcon,
  ShuffleIcon,
  RepeatGlyph,
  PlayGlyph,
  PauseGlyph,
  SkipPrevGlyph,
  SkipNextGlyph,
} from "./icons";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// The phone's full-screen player, opened by tapping the mini player. Big artwork, a seek bar
// you can actually grab, and thumb-sized controls. It owns no playback logic: it reads the
// store and calls the handlers Player passes in, so there is still exactly one audio engine.
export default function NowPlayingSheet({ isOpen, onClose, track, onSeek, onPrev, onNext, onToggle }) {
  const store = usePlayerStore();
  const { isLiked, toggleLike } = useLikeStore();
  // While a finger is on the slider, follow it locally and only seek on release — seeking on
  // every pixel of a drag would fire dozens of range requests at a streamed file.
  const [dragValue, setDragValue] = useState(null);

  if (!isOpen || !track) return null;

  const duration = store.duration || 0;
  const shown = dragValue ?? store.progress;
  const pct = Math.round(shown * 1000) / 10;
  const isBuffering = store.loadState === "finding" || store.loadState === "loading";
  const liked = isLiked(track.id);

  const commitSeek = () => {
    if (dragValue !== null) {
      onSeek(dragValue);
      setDragValue(null);
    }
  };

  return (
    <div className="np-sheet" role="dialog" aria-label="Now playing">
      {track.cover_url && <div className="np-bg" style={{ backgroundImage: `url(${track.cover_url})` }} aria-hidden="true" />}

      <header className="np-header">
        <button className="np-icon-btn" onClick={onClose} aria-label="Minimise player">
          <ChevronDownIcon />
        </button>
        <div className="np-context">
          <span>PLAYING FROM</span>
          <strong>{store.contextName || "Queue"}</strong>
        </div>
        <button
          className="np-icon-btn"
          onClick={() => {
            onClose();
            store.setQueueOpen(true);
          }}
          aria-label="Open queue"
        >
          <QueueListIcon />
        </button>
      </header>

      <div className="np-art-wrap">
        {track.cover_url ? (
          <img src={track.cover_url} alt={track.title} className="np-art" />
        ) : (
          <div className="np-art np-art-fallback" aria-hidden="true">🎵</div>
        )}
      </div>

      <div className="np-titles">
        <div className="np-title-block">
          <h2 className="np-title">{track.title}</h2>
          <p className="np-artist">{track.artist}</p>
        </div>
        <button
          className={`np-icon-btn np-like ${liked ? "liked" : ""}`}
          onClick={() => toggleLike(track.id)}
          aria-label={liked ? "Remove from Liked" : "Add to Liked"}
          aria-pressed={liked}
        >
          <HeartIcon filled={liked} />
        </button>
      </div>

      <div className="np-seek">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={shown}
          onChange={(e) => setDragValue(parseFloat(e.target.value))}
          onPointerUp={commitSeek}
          onKeyUp={commitSeek}
          onBlur={commitSeek}
          aria-label="Seek"
          style={{ "--np-pct": `${pct}%` }}
        />
        <div className="np-times">
          <span>{formatTime(shown * duration)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="np-controls">
        <button
          className={`np-ctrl ${store.shuffle ? "active" : ""}`}
          onClick={store.toggleShuffle}
          aria-label="Toggle shuffle"
          aria-pressed={store.shuffle}
        >
          <ShuffleIcon size={22} />
        </button>
        <button className="np-ctrl np-ctrl-lg" onClick={onPrev} aria-label="Previous">
          <SkipPrevGlyph />
        </button>
        <button
          className="np-play"
          onClick={onToggle}
          aria-label={store.playing ? "Pause" : "Play"}
          aria-busy={isBuffering}
        >
          {isBuffering ? <span className="play-spinner play-spinner-lg" aria-hidden="true" /> : store.playing ? <PauseGlyph size={30} /> : <PlayGlyph size={30} />}
        </button>
        <button className="np-ctrl np-ctrl-lg" onClick={onNext} aria-label="Next">
          <SkipNextGlyph />
        </button>
        <button
          className={`np-ctrl ${store.repeat !== "off" ? "active" : ""}`}
          onClick={store.toggleRepeat}
          aria-label="Toggle repeat"
          aria-pressed={store.repeat !== "off"}
        >
          <RepeatGlyph one={store.repeat === "one"} />
        </button>
      </div>
    </div>
  );
}
