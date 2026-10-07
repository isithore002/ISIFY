import { useState } from "react";
import { DEFAULT_LIBRARY_PLAYLISTS, POPULAR_SONGS, TRENDY_SONGS } from "../data/mockMusfluentData";
import { useLibraryStore } from "../store/libraryStore";
import { useLocalStore } from "../store/localStore";
import { usePlayerStore } from "../store/playerStore";
import { usePlaylistStore } from "../store/playlistStore";
import { PlaylistPlusIcon } from "./icons";

// Everything under "My Library": the user's own playlists, imported ones, local folders, and
// the buttons to create/import. Shared by the desktop sidebar and the phone's Library screen.
function formatListenTime(ms) {
  const minutes = ms / 60000;
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  return `${minutes < 10 ? minutes.toFixed(1) : Math.round(minutes).toLocaleString()} min`;
}

export default function LibrarySection({ selectedPlaylist, onSelectPlaylist, onOpenImport }) {
  const localPlaylists = useLibraryStore((s) => s.playlists);
  const localFolders = useLocalStore((s) => s.folders);
  const totalListenMs = usePlayerStore((s) => s.totalListenMs);
  const showToast = usePlayerStore((s) => s.showToast);
  const userPlaylists = usePlaylistStore((s) => s.playlists);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const createPlaylist = (e) => {
    e.preventDefault();
    const playlist = usePlaylistStore.getState().create(newName || "New playlist");
    setCreating(false);
    setNewName("");
    onSelectPlaylist(playlist);
    showToast(`Created ${playlist.name}`);
  };

  const handleDefaultPlaylistClick = (item) => {
    // Generate mock list or trigger playback
    const sampleTracks = item.id === "lib-best-year" ? POPULAR_SONGS : TRENDY_SONGS;
    onSelectPlaylist({
      id: item.id,
      name: item.name,
      description: "Curated collection", // the song count is shown separately, from the real list
      owner: "ISIFY",
      tracks: sampleTracks,
      cover_url: sampleTracks[0]?.cover_url,
    });
  };

  return (
      <div className="library-section">
        <div className="library-header">
          <span className="library-title">My Library</span>
          <div className="library-actions">
            <button
              className="library-add-btn"
              onClick={() => setCreating((c) => !c)}
              title="Create a new playlist"
              aria-label="Create a new playlist"
              aria-expanded={creating}
            >
              <PlaylistPlusIcon />
            </button>
            <button
              className="library-add-btn"
              onClick={onOpenImport}
              title="Import playlist / Add local music"
              aria-label="Add music"
            >
              +
            </button>
          </div>
        </div>

        <div className="library-stats" aria-label="Listening stats">
          <div className="library-stat-card">
            <span className="library-stat-label">Listen time</span>
            <span className="library-stat-value">{formatListenTime(totalListenMs)}</span>
            <span className="library-stat-caption">All time</span>
          </div>
        </div>

        <div className="library-list">
          {creating && (
            <form onSubmit={createPlaylist} className="library-new">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="Playlist name, then Enter"
                maxLength={60}
                autoFocus
                aria-label="New playlist name"
              />
            </form>
          )}

          {/* Playlists the user made */}
          {userPlaylists.map((pl) => (
            <button
              key={pl.id}
              className={`library-item ${selectedPlaylist?.id === pl.id ? "active" : ""}`}
              onClick={() => onSelectPlaylist(pl)}
            >
              <span className="library-item-bullet bullet-user">♪</span>
              <span className="library-item-name" title={pl.name}>{pl.name}</span>
              <span className="library-item-count">{pl.tracks.length}</span>
            </button>
          ))}

          {/* Default Playlists mirroring screenshot */}
          {DEFAULT_LIBRARY_PLAYLISTS.map((pl) => (
            <button
              key={pl.id}
              className={`library-item ${selectedPlaylist?.id === pl.id ? "active" : ""}`}
              onClick={() => handleDefaultPlaylistClick(pl)}
            >
              <span className="library-item-bullet">◉</span>
              <span className="library-item-name">{pl.name}</span>
            </button>
          ))}

          {/* User Imported Playlists */}
          {localPlaylists.map((pl) => (
            <div key={pl.id} className="library-custom-row">
              <button
                className={`library-item ${selectedPlaylist?.id === pl.id ? "active" : ""}`}
                onClick={() => onSelectPlaylist(pl)}
              >
                <span className="library-item-bullet bullet-imported">◉</span>
                <span className="library-item-name" title={pl.name}>{pl.name}</span>
              </button>
              <button
                className="library-remove-btn"
                title="Remove playlist"
                onClick={() => useLibraryStore.getState().remove(pl.id)}
              >
                ✕
              </button>
            </div>
          ))}

          {/* Local Music Folders */}
          {localFolders.map((folder) => (
            <div key={folder.id} className="library-custom-row">
              <button
                className={`library-item ${selectedPlaylist?.folderId === folder.id ? "active" : ""}`}
                onClick={() => {
                  const pl = useLocalStore.getState().playlists[folder.id];
                  if (pl) onSelectPlaylist(pl);
                  else useLocalStore.getState().openFolder(folder).then(onSelectPlaylist);
                }}
              >
                <span className="library-item-bullet">📁</span>
                <span className="library-item-name" title={folder.name}>{folder.name}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
  );
}
