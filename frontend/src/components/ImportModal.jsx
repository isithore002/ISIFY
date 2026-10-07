import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { importPlaylist } from "../api/playlist";
import { useLibraryStore } from "../store/libraryStore";
import { useLocalStore } from "../store/localStore";
import { usePlayerStore } from "../store/playerStore";

export default function ImportModal({ isOpen, onClose, onSelectPlaylist }) {
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState("url");
  const showToast = usePlayerStore((s) => s.showToast);

  const importMut = useMutation({
    mutationFn: importPlaylist,
    onSuccess: (data) => {
      useLibraryStore.getState().add(data);
      onSelectPlaylist(data);
      setUrl("");
      showToast(`Successfully imported: ${data.name}`);
      onClose();
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || err.message || "Import failed");
    },
  });

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      importMut.mutate(url.trim());
    }
  };

  const handleOpenFolder = async () => {
    try {
      const pl = await useLocalStore.getState().pickFolder();
      if (pl) {
        onSelectPlaylist(pl);
        showToast(`Loaded local folder: ${pl.name}`);
        onClose();
      }
    } catch (err) {
      showToast(err.message || "Failed to open folder");
    }
  };

  const handleOpenFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow picking the same files again later
    if (files.length === 0) return;
    try {
      const name = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : `${files.length} songs`;
      const pl = await useLocalStore.getState().addFiles(files, name);
      if (pl) {
        onSelectPlaylist(pl);
        showToast(`Loaded ${files.length} audio files`);
        onClose();
      }
    } catch (err) {
      showToast(err.message || "Failed to load files");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add to Your Library</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === "url" ? "active" : ""}`}
            onClick={() => setTab("url")}
          >
            Import by URL
          </button>
          <button
            className={`modal-tab ${tab === "local" ? "active" : ""}`}
            onClick={() => setTab("local")}
          >
            Local Files & Folders
          </button>
        </div>

        <div className="modal-body">
          {tab === "url" && (
            <form onSubmit={handleUrlSubmit} className="modal-url-form">
              <label className="modal-label">Paste Playlist, Album, or Track Link:</label>
              <input
                type="text"
                className="modal-input"
                placeholder="Spotify, YouTube, Apple Music or SoundCloud URL…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
              />
              <div className="modal-chip-row">
                <span className="platform-tag">Spotify</span>
                <span className="platform-tag">YouTube</span>
                <span className="platform-tag">Apple Music</span>
                <span className="platform-tag">SoundCloud</span>
              </div>
              <button
                type="submit"
                className="modal-submit-btn"
                disabled={importMut.isPending || !url.trim()}
              >
                {importMut.isPending ? "Importing…" : "Import to ISIFY"}
              </button>
            </form>
          )}

          {tab === "local" && (
            <div className="modal-local-options">
              <button className="modal-local-btn" onClick={handleOpenFolder}>
                <span className="modal-btn-icon">📁</span>
                <div>
                  <strong>Add Folder from Computer</strong>
                  <p>Keeps metadata and tags without uploading</p>
                </div>
              </button>

              <label className="modal-local-btn file-input-label">
                <span className="modal-btn-icon">🎵</span>
                <div>
                  <strong>Open Audio Files</strong>
                  <p>MP3, FLAC, WAV, M4A, OGG, AAC, Opus</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="audio/*"
                  onChange={handleOpenFiles}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
