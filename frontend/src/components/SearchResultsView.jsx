import { useState } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useLikeStore } from "../store/likeStore";
import { downloadTrack, trackErrorMessage, warmOnHover } from "../api/track";
import TrackMenu from "./TrackMenu";

function formatDuration(ms) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// `genre` ({ name, emoji, language, hue }) turns this into a genre page: the whole list is queued
// so the genre keeps playing, whereas a search result plays on its own and autoplay finds what
// comes after it.
export default function SearchResultsView({ query, results, genre, onBack }) {
  const store = usePlayerStore();
  const { isLiked, toggleLike } = useLikeStore();
  const [downloadingId, setDownloadingId] = useState(null);

  // Context menu state
  const [activeMenuTrack, setActiveMenuTrack] = useState(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const currentTrack = store.currentTrack();

  const handlePlayTrack = (track) => {
    if (!genre) return store.playFromSearch(track, query); // just this song; autoplay lines up songs like it
    const index = Math.max(0, results.findIndex((t) => t.id === track.id));
    store.setQueue(results, index, null, `${genre.language} · ${genre.name}`, { autoplay: true });
    store.setPlaying(true);
  };

  const handleDownload = async (track) => {
    setDownloadingId(track.id);
    try {
      await downloadTrack(track);
      store.showToast(`Downloaded: ${track.title}`);
    } catch (err) {
      store.showToast(await trackErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const openTrackMenu = (e, track) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x: rect.right - 200, y: rect.bottom + 4 });
    setActiveMenuTrack(track);
  };

  return (
    <div className="search-results-view">
      {/* ── Search Header ── */}
      <div
        className={`search-results-header ${genre ? "genre-header" : ""}`}
        style={genre ? { "--hue": genre.hue } : undefined}
      >
        <button className="search-back-btn" onClick={onBack} title={genre ? "Back to genres" : "Back to Discover"}>
          ← Back
        </button>
        <div className="search-header-titles">
          {genre ? (
            <>
              <span className="search-label">{genre.language.toUpperCase()} · GENRE</span>
              <h1 className="search-title">{genre.emoji} {genre.name}</h1>
              <span className="search-meta">{results.length} songs from YouTube · keeps playing similar songs after the last one</span>
            </>
          ) : (
            <>
              <span className="search-label">YOUTUBE SEARCH</span>
              <h1 className="search-title">"{query}"</h1>
              <span className="search-meta">{results.length} songs found on YouTube</span>
            </>
          )}
        </div>
        {results.length > 0 && (
          <button
            className="play-all-btn search-play-all"
            onClick={() => handlePlayTrack(results[0])}
          >
            {genre ? "▶ Play" : "▶ Play Top Result"}
          </button>
        )}
      </div>

      {/* ── Results List ── */}
      <div className="search-track-list">
        <div className="tracklist-header">
          <span>#</span>
          <span></span>
          <span>TITLE</span>
          <span>UPLOADER</span>
          <span></span>
          <span>⏱</span>
        </div>

        {results.map((track, i) => {
          const isCurrent = currentTrack?.id === track.id || currentTrack?.yt_video_id === track.yt_video_id;
          const isPlaying = isCurrent && store.playing;
          const isLoading = isCurrent && (store.loadState === "finding" || store.loadState === "loading");
          const liked = isLiked(track.id);

          return (
            <div
              key={track.id || track.yt_video_id}
              className={`track-row ${isCurrent ? "current" : ""}`}
              onClick={() => handlePlayTrack(track)}
              {...warmOnHover(track)}
            >
              <div className="track-num">
                {isLoading ? (
                  <span className="playing-anim" title="Downloading from YouTube…">⏳</span>
                ) : isPlaying ? (
                  <span className="playing-anim">▶</span>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>

              <div className="track-cover-wrap">
                {track.cover_url ? (
                  <img src={track.cover_url} alt={track.title} className="track-cover" />
                ) : (
                  <div className="track-cover track-cover-fallback">🎵</div>
                )}
              </div>

              <div className="track-meta">
                <span className="track-title" title={track.title}>{track.title}</span>
                <span className="track-artist" title={track.artist}>{track.artist}</span>
              </div>

              <span className="track-album">{track.artist}</span>

              <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`card-action-btn like-btn ${liked ? "liked" : ""}`}
                  onClick={() => toggleLike(track.id)}
                  title={liked ? "Remove from Liked" : "Like song"}
                >
                  {liked ? "♥" : "♡"}
                </button>

                <button
                  className="icon-btn"
                  title="Play next"
                  onClick={() => store.playNext(track)}
                >
                  ⏭
                </button>

                <button
                  className="icon-btn"
                  title="Add to queue"
                  onClick={() => store.addToQueue(track)}
                >
                  ➕
                </button>

                <button
                  className="icon-btn"
                  title="Download MP3"
                  onClick={() => handleDownload(track)}
                  disabled={downloadingId === track.id}
                >
                  {downloadingId === track.id ? "⏳" : "⬇"}
                </button>

                <button
                  className="icon-btn more-btn"
                  title="More options"
                  onClick={(e) => openTrackMenu(e, track)}
                >
                  ⋯
                </button>
              </div>

              <span className="track-duration">{formatDuration(track.duration_ms)}</span>
            </div>
          );
        })}
      </div>

      {activeMenuTrack && (
        <TrackMenu
          isOpen={Boolean(activeMenuTrack)}
          position={menuPos}
          track={activeMenuTrack}
          onClose={() => setActiveMenuTrack(null)}
          onPlayNow={() => handlePlayTrack(activeMenuTrack)}
          onPlayNext={() => store.playNext(activeMenuTrack)}
          onAddToQueue={() => store.addToQueue(activeMenuTrack)}
          onDownload={() => handleDownload(activeMenuTrack)}
        />
      )}
    </div>
  );
}
