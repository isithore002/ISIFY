import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { importPlaylist } from "../api/playlist";
import { useLibraryStore } from "../store/libraryStore";
import { useLocalStore, canRememberFolders } from "../store/localStore";
import { AUDIO_ACCEPT } from "../lib/localAudio";

const PLATFORMS = ["Spotify", "YouTube", "Apple Music", "SoundCloud", "Your computer"];

// The main content area's own onboarding view: the same actions as the sidebar's import
// box and local-music buttons, just given the room to be an actual first screen instead
// of a line of text pointing at a cramped sidebar field.
export default function EmptyState({ onSelect }) {
  const [url, setUrl] = useState("");
  const filesInput = useRef(null);
  const folderInput = useRef(null);

  const importMut = useMutation({
    mutationFn: importPlaylist,
    onSuccess: (data) => {
      useLibraryStore.getState().add(data);
      onSelect(data);
      setUrl("");
    },
  });

  const handleAddFolder = async () => {
    if (!canRememberFolders) return folderInput.current.click();
    try {
      const playlist = await useLocalStore.getState().pickFolder();
      if (playlist) onSelect(playlist);
    } catch (e) {
      if (e.name !== "AbortError") useLocalStore.setState({ error: e.message });
    }
  };

  const handleFileInput = async (e, isFolder) => {
    const files = e.target.files;
    if (!files?.length) return;
    const name = isFolder
      ? files[0].webkitRelativePath.split("/")[0]
      : files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : `${files.length} songs`;
    const playlist = await useLocalStore.getState().addFiles(files, name);
    e.target.value = ""; // allow picking the same files again
    if (playlist) onSelect(playlist);
  };

  return (
    <div className="empty-state">
      <div className="empty-card">
        <div className="empty-icon" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="10" width="3" height="4" rx="1.5" fill="#0a2e14" />
            <rect x="7.5" y="6" width="3" height="12" rx="1.5" fill="#0a2e14" />
            <rect x="13" y="1.5" width="3" height="21" rx="1.5" fill="#0a2e14" />
            <rect x="18.5" y="7" width="3" height="10" rx="1.5" fill="#0a2e14" />
          </svg>
        </div>

        <h1 className="empty-title">Bring your music here</h1>
        <p className="empty-subtitle">
          Paste a song, album or playlist link, or play songs straight from your computer.
        </p>

        <form
          className="empty-import-form"
          onSubmit={(e) => { e.preventDefault(); if (url.trim()) importMut.mutate(url.trim()); }}
        >
          <input
            className="empty-import-input"
            placeholder="Spotify, YouTube, Apple Music or SoundCloud link…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <button className="empty-import-btn" type="submit" disabled={importMut.isPending}>
            {importMut.isPending ? "Importing…" : "Import"}
          </button>
        </form>
        {importMut.isError && (
          <p className="empty-error">
            {importMut.error?.response?.data?.detail || importMut.error?.message || "Import failed"}
          </p>
        )}

        <div className="empty-divider">or</div>

        <div className="empty-actions">
          <button type="button" className="empty-action-btn" onClick={handleAddFolder}>
            📁 Add a folder
          </button>
          <button type="button" className="empty-action-btn" onClick={() => filesInput.current.click()}>
            🎵 Open files
          </button>
        </div>
        <input ref={filesInput} type="file" accept={AUDIO_ACCEPT} multiple hidden
          onChange={(e) => handleFileInput(e, false)} />
        <input ref={folderInput} type="file" webkitdirectory="" multiple hidden
          onChange={(e) => handleFileInput(e, true)} />

        <div className="empty-platforms">
          {PLATFORMS.map((p) => (
            <span key={p} className="empty-platform-chip">{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
