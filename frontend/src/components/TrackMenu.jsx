import { useEffect, useRef, useState } from "react";
import { usePlaylistStore } from "../store/playlistStore";
import { usePlayerStore } from "../store/playerStore";

export default function TrackMenu({
  isOpen,
  position,
  track,
  onClose,
  onPlayNow,
  onPlayNext,
  onAddToQueue,
  onDownload,
  onCache,
  onRemove, // set when the song is inside one of the user's playlists
  isCached,
  isDownloading,
  isCaching,
}) {
  const menuRef = useRef(null);
  const [picking, setPicking] = useState(false); // "Add to playlist" list expanded
  const [newName, setNewName] = useState("");
  const playlists = usePlaylistStore((s) => s.playlists);

  // Every way of closing also collapses the picker, so the next song's menu opens fresh
  const close = () => {
    setPicking(false);
    setNewName("");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) close();
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  if (!isOpen || !track) return null;

  const canAddToPlaylist = !track.local && !track.file; // a local file can't be saved in a playlist

  const addTo = (playlist) => {
    const result = usePlaylistStore.getState().addTrack(playlist.id, track);
    const toast = usePlayerStore.getState().showToast;
    if (result === "added") toast(`Added to ${playlist.name}`);
    else if (result === "duplicate") toast(`Already in ${playlist.name}`);
    else toast("That song can't be added to a playlist");
    close();
  };

  const createAndAdd = (e) => {
    e.preventDefault();
    const { create, addTrack } = usePlaylistStore.getState();
    const playlist = create(newName || "New playlist");
    addTrack(playlist.id, track);
    usePlayerStore.getState().showToast(`Created ${playlist.name} and added the song`);
    close();
  };

  // Viewport clamping (the picker makes the menu taller)
  const menuWidth = 220;
  const menuHeight = picking ? 380 : 260;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 12);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 90);

  return (
    <>
    {/* Dims the page behind the menu on phones, where it becomes a bottom sheet; tapping it closes */}
    <div className="track-menu-backdrop" onClick={close} aria-hidden="true" />
    <div
      ref={menuRef}
      className="track-context-menu"
      style={{ top: `${Math.max(12, y)}px`, left: `${Math.max(12, x)}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="track-menu-header">
        <span className="track-menu-title">{track.title}</span>
        <span className="track-menu-artist">{track.artist}</span>
      </div>

      <div className="track-menu-divider" />

      <button
        className="track-menu-item"
        onClick={() => {
          onPlayNow?.();
          close();
        }}
      >
        <span className="track-menu-icon">▶</span>
        <span>Play now</span>
      </button>

      <button
        className="track-menu-item"
        onClick={() => {
          onPlayNext?.();
          close();
        }}
      >
        <span className="track-menu-icon">⏭</span>
        <span>Play next</span>
      </button>

      <button
        className="track-menu-item"
        onClick={() => {
          onAddToQueue?.();
          close();
        }}
      >
        <span className="track-menu-icon">➕</span>
        <span>Add to queue</span>
      </button>

      {canAddToPlaylist && (
        <>
          <div className="track-menu-divider" />

          <button
            className="track-menu-item"
            onClick={() => setPicking((p) => !p)}
            aria-expanded={picking}
          >
            <span className="track-menu-icon">♪</span>
            <span>Add to playlist</span>
            <span className="track-menu-chevron">{picking ? "▾" : "▸"}</span>
          </button>

          {picking && (
            <div className="track-menu-playlists">
              <form onSubmit={createAndAdd} className="track-menu-new">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="+ New playlist (Enter)"
                  maxLength={60}
                  autoFocus
                />
              </form>
              {playlists.length === 0 && (
                <p className="track-menu-empty">No playlists yet — type a name above</p>
              )}
              {playlists.map((pl) => (
                <button key={pl.id} className="track-menu-item track-menu-playlist" onClick={() => addTo(pl)}>
                  <span className="track-menu-playlist-name">{pl.name}</span>
                  <span className="track-menu-count">{pl.tracks.length}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {onRemove && (
        <>
          <div className="track-menu-divider" />
          <button
            className="track-menu-item track-menu-danger"
            onClick={() => {
              onRemove();
              close();
            }}
          >
            <span className="track-menu-icon">✕</span>
            <span>Remove from this playlist</span>
          </button>
        </>
      )}

      {!track.local && (
        <>
          <div className="track-menu-divider" />

          <button
            className="track-menu-item"
            onClick={() => {
              onDownload?.();
              close();
            }}
            disabled={isDownloading}
          >
            <span className="track-menu-icon">⬇</span>
            <span>{isDownloading ? "Downloading…" : "Download MP3"}</span>
          </button>

          <button
            className="track-menu-item"
            onClick={() => {
              onCache?.();
              close();
            }}
            disabled={isCaching || isCached}
          >
            <span className="track-menu-icon">{isCached ? "✓" : "💾"}</span>
            <span>{isCached ? "Saved offline" : isCaching ? "Saving…" : "Save offline"}</span>
          </button>
        </>
      )}
    </div>
    </>
  );
}
