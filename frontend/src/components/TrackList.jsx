import { useState, useEffect } from "react";
import { usePlayerStore } from "../store/playerStore";
import { useDownloadStore } from "../store/downloadStore";
import { useLocalStore } from "../store/localStore";
import { usePlaylistStore } from "../store/playlistStore";
import EmptyState from "./EmptyState";
import TrackMenu from "./TrackMenu";
import { ShuffleIcon, TrashIcon } from "./icons";
import { cacheTrack, isTrackCached } from "../hooks/useOfflineCache";
import { downloadTrack, trackErrorMessage, warmTracks, warmOnHover } from "../api/track";

function formatDuration(ms) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function TrackRow({ track, index, isCurrent, isPlaying, isLoading, onPlay, onRemove }) {
  const store = usePlayerStore();
  const [caching, setCaching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);

  // Context menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Resting the pointer on a song usually means a click is coming — start getting it ready
  const hover = warmOnHover(track);

  useEffect(() => {
    if (track.local) return;
    isTrackCached(track.id).then(setCached);
  }, [track.id, track.local]);

  const handleCache = async (e) => {
    e?.stopPropagation();
    setCaching(true);
    setError(null);
    try {
      await cacheTrack(track);
      setCached(true);
      store.showToast(`Saved offline: ${track.title}`);
    } catch (err) {
      setError(await trackErrorMessage(err));
    } finally {
      setCaching(false);
    }
  };

  const handleDownload = async (e) => {
    e?.stopPropagation();
    setDownloading(true);
    setError(null);
    try {
      await downloadTrack(track);
      store.showToast(`Downloaded: ${track.title}`);
    } catch (err) {
      setError(await trackErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const handlePlayNext = (e) => {
    e?.stopPropagation();
    store.playNext(track);
  };

  const handleAddToQueue = (e) => {
    e?.stopPropagation();
    store.addToQueue(track);
  };

  const openContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  const openMenuFromButton = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x: rect.right - 200, y: rect.bottom + 4 });
    setMenuOpen(true);
  };

  return (
    <>
      <div
        className={`track-row ${isCurrent ? "current" : ""}`}
        onClick={onPlay}
        onContextMenu={openContextMenu}
        {...hover}
      >
        <div className="track-num">
          {isCurrent && isLoading ? (
            <span className="playing-anim" title="Loading…">⏳</span>
          ) : isCurrent && isPlaying ? (
            <span className="playing-anim">▶</span>
          ) : (
            <span>{index + 1}</span>
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
          <span className="track-title">{track.title}</span>
          <span className="track-artist">{track.artist}</span>
        </div>

        <span className="track-album">{track.album}</span>

        <div className="track-actions">
          {/* Play next button */}
          <button
            className="icon-btn"
            title="Play next"
            onClick={handlePlayNext}
            aria-label="Play next"
          >
            ⏭
          </button>

          {/* Add to queue button */}
          <button
            className="icon-btn"
            title="Add to queue"
            onClick={handleAddToQueue}
            aria-label="Add to queue"
          >
            ➕
          </button>

          {!track.local && (
            <>
              <button
                className={`icon-btn ${error ? "icon-btn-error" : ""}`}
                title={error ? `Failed: ${error} — click to retry` : "Download this song as an MP3 to your computer"}
                onClick={handleDownload}
                disabled={downloading}
                aria-label="Download MP3"
              >
                {downloading ? "⏳" : error ? "⚠" : "⬇"}
              </button>
              <button
                className="icon-btn"
                title={cached ? "Saved in this browser for offline playback" : "Save in this browser for offline playback"}
                onClick={handleCache}
                disabled={caching || cached}
                aria-label="Save offline"
              >
                {caching ? "⏳" : cached ? "✓" : "💾"}
              </button>
            </>
          )}

          {/* Only inside the user's own playlists */}
          {onRemove && (
            <button
              className="icon-btn"
              title="Remove from this playlist"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label="Remove from this playlist"
            >
              ✕
            </button>
          )}

          {/* Context menu button */}
          <button
            className="icon-btn more-btn"
            title="More options"
            onClick={openMenuFromButton}
            aria-label="More options"
          >
            ⋯
          </button>
        </div>

        <span className="track-duration">{formatDuration(track.duration_ms)}</span>
      </div>

      <TrackMenu
        isOpen={menuOpen}
        position={menuPos}
        track={track}
        onClose={() => setMenuOpen(false)}
        onPlayNow={onPlay}
        onPlayNext={handlePlayNext}
        onAddToQueue={handleAddToQueue}
        onDownload={handleDownload}
        onCache={handleCache}
        onRemove={onRemove}
        isCached={cached}
        isDownloading={downloading}
        isCaching={caching}
      />
    </>
  );
}

function DownloadAll({ playlist }) {
  const job = useDownloadStore((s) => s.jobs[playlist.id]);
  const downloadAll = useDownloadStore((s) => s.downloadAll);
  const running = job?.status === "running";
  const failed = job?.failed ?? [];

  return (
    <div className="download-all">
      <button
        className="download-all-btn"
        onClick={() => downloadAll(playlist)}
        disabled={running}
        title="Download every song as one ZIP"
      >
        {running ? `Downloading ${job.done}/${job.total}…` : "⬇ Download all"}
      </button>
      {running && (
        <div className="bulk-progress">
          <div style={{ width: `${(100 * job.done) / Math.max(job.total, 1)}%` }} />
        </div>
      )}
      {job?.status === "ready" && (
        <span className="bulk-status" title={failed.map((f) => `${f.title}: ${f.error}`).join("\n")}>
          ZIP saved · {job.total - failed.length}/{job.total} songs
          {failed.length > 0 && ` · ${failed.length} not found`}
        </span>
      )}
      {job?.status === "error" && <span className="bulk-status bulk-error">{job.error}</span>}
    </div>
  );
}

function RescanFolder({ playlist }) {
  const folder = useLocalStore((s) => s.folders.find((f) => f.id === playlist.folderId));
  const busy = useLocalStore((s) => s.loading?.folderId === playlist.folderId);
  if (!folder?.handle) return null; // session-only folders can't be re-read

  return (
    <button
      className="download-all-btn"
      onClick={() => useLocalStore.getState().openFolder(folder, { rescan: true })}
      disabled={busy}
      title="Pick up songs added to or removed from this folder"
    >
      {busy ? "Scanning…" : "↻ Rescan"}
    </button>
  );
}

// Rename and delete, for playlists the user made themselves
function UserPlaylistTools({ playlist, onDeleted }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(playlist.name);
  const [confirming, setConfirming] = useState(false);

  const submitRename = (e) => {
    e.preventDefault();
    usePlaylistStore.getState().rename(playlist.id, name);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <form onSubmit={submitRename} className="playlist-rename">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
          maxLength={60}
          autoFocus
          aria-label="Playlist name"
        />
        <button type="submit" className="download-all-btn">Save</button>
        <button type="button" className="download-all-btn" onClick={() => setRenaming(false)}>Cancel</button>
      </form>
    );
  }

  if (confirming) {
    return (
      <span className="playlist-confirm">
        Delete “{playlist.name}”?
        <button
          className="download-all-btn danger"
          onClick={() => {
            usePlaylistStore.getState().remove(playlist.id);
            usePlayerStore.getState().showToast(`Deleted ${playlist.name}`);
            onDeleted();
          }}
        >
          Yes, delete
        </button>
        <button className="download-all-btn" onClick={() => setConfirming(false)}>Keep</button>
      </span>
    );
  }

  return (
    <>
      <button
        className="download-all-btn"
        onClick={() => {
          setName(playlist.name);
          setRenaming(true);
        }}
      >
        ✎ Rename
      </button>
      <button className="download-all-btn pill-icon" onClick={() => setConfirming(true)} title="Delete playlist">
        <TrashIcon /> Delete
      </button>
    </>
  );
}

export default function TrackList({ playlist: selected, onSelect }) {
  const store = usePlayerStore();
  // Local folders can be rescanned and user playlists edited — always show the latest version
  const rescanned = useLocalStore((s) => (selected?.folderId ? s.playlists[selected.folderId] : null));
  const edited = usePlaylistStore((s) =>
    selected?.kind === "user" ? s.playlists.find((p) => p.id === selected.id) : null,
  );
  const playlist = edited ?? rescanned ?? selected;

  // Opening a playlist: get its first songs ready so the first click starts fast
  const openedId = playlist?.id;
  useEffect(() => {
    if (!playlist || playlist.local || !playlist.tracks.length) return;
    warmTracks(playlist.tracks.slice(0, 2)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedId]);

  if (!playlist) return <EmptyState onSelect={onSelect} />;

  const isUser = playlist.kind === "user";
  const currentTrack = store.currentTrack();
  // "Current" means this playlist is the one playing AND this row is the song playing. It
  // used to compare the row's position with the queue position — but with shuffle on the
  // queue is reordered, so the wrong row lit up and clicking a row paused instead of playing.
  const playlistIsCurrent = store.playlistId === playlist.id && Boolean(currentTrack);
  const isCurrentRow = (track) => playlistIsCurrent && currentTrack.id === track.id;

  const handlePlay = (index) => {
    const track = playlist.tracks[index];
    if (isCurrentRow(track)) {
      store.setPlaying(!store.playing);
    } else {
      store.setQueue(playlist.tracks, index, playlist.id, playlist.name);
      store.setPlaying(true);
    }
  };

  // The header button toggles the playlist that's already loaded, and otherwise starts it —
  // from a random song when shuffle is on, as Spotify does.
  const handleHeaderPlay = () => {
    if (playlistIsCurrent) return store.setPlaying(!store.playing);
    const start = store.shuffle ? Math.floor(Math.random() * playlist.tracks.length) : 0;
    handlePlay(start);
  };

  const headerPlaying = playlistIsCurrent && store.playing;
  const hasTracks = playlist.tracks.length > 0;

  return (
    <div className="tracklist">
      <div className="playlist-header">
        {playlist.cover_url ? (
          <img src={playlist.cover_url} alt={playlist.name} className="playlist-hero" />
        ) : (
          <div className="playlist-hero playlist-hero-fallback">🎵</div>
        )}
        <div className="playlist-header-info">
          <span className="playlist-type">
            {playlist.local ? "LOCAL MUSIC" : isUser ? "YOUR PLAYLIST" : "PLAYLIST"}
          </span>
          <h1 className="playlist-title">{playlist.name}</h1>
          {playlist.description && <p className="playlist-desc">{playlist.description}</p>}
          <span className="playlist-meta">
            {playlist.owner} · {playlist.tracks.length} {playlist.tracks.length === 1 ? "song" : "songs"}
          </span>
          <div className="playlist-controls">
            {hasTracks && (
              <>
                <button className="play-all-btn" onClick={handleHeaderPlay}>
                  {headerPlaying ? "⏸ Pause" : "▶ Play"}
                </button>
                <button
                  className="download-all-btn pill-icon"
                  onClick={() => store.playShuffled(playlist.tracks, playlist.id, playlist.name)}
                  title="Play in random order"
                >
                  <ShuffleIcon /> Shuffle
                </button>
              </>
            )}
            {isUser ? (
              <UserPlaylistTools playlist={playlist} onDeleted={() => onSelect?.(null)} />
            ) : playlist.local ? (
              <RescanFolder playlist={playlist} />
            ) : (
              hasTracks && <DownloadAll playlist={playlist} />
            )}
          </div>
          {playlist.notice && <p className="playlist-notice">{playlist.notice}</p>}
        </div>
      </div>

      {!hasTracks ? (
        <div className="playlist-empty">
          <span className="playlist-empty-icon">🎶</span>
          <p className="playlist-empty-title">This playlist is empty</p>
          <p className="playlist-empty-text">
            Open the <strong>⋯</strong> menu on any song and choose <strong>Add to playlist</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="tracklist-header">
            <span>#</span>
            <span></span>
            <span>TITLE</span>
            <span>ALBUM</span>
            <span></span>
            <span>⏱</span>
          </div>

          {playlist.tracks.map((track, i) => (
            <TrackRow
              key={`${track.id}-${i}`}
              track={track}
              index={i}
              isCurrent={isCurrentRow(track)}
              isPlaying={store.playing}
              isLoading={store.loadState === "finding" || store.loadState === "loading"}
              onPlay={() => handlePlay(i)}
              onRemove={isUser ? () => usePlaylistStore.getState().removeTrack(playlist.id, track.id) : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}
