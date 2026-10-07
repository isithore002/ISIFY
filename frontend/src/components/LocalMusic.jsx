import { useEffect, useRef } from "react";
import { useLocalStore, canRememberFolders } from "../store/localStore";
import { AUDIO_ACCEPT } from "../lib/localAudio";

export default function LocalMusic({ onSelect, selected }) {
  const folders = useLocalStore((s) => s.folders);
  const playlists = useLocalStore((s) => s.playlists);
  const loading = useLocalStore((s) => s.loading);
  const error = useLocalStore((s) => s.error);
  const filesInput = useRef(null);
  const folderInput = useRef(null);

  useEffect(() => {
    useLocalStore.getState().init();
  }, []);

  const show = (playlist) => { if (playlist) onSelect(playlist); };

  const handleAddFolder = async () => {
    if (!canRememberFolders) return folderInput.current.click();
    try {
      show(await useLocalStore.getState().pickFolder());
    } catch (e) {
      if (e.name !== "AbortError") useLocalStore.setState({ error: e.message });
    }
  };

  const handleInput = async (e, isFolder) => {
    const files = e.target.files;
    if (!files?.length) return;
    const name = isFolder
      ? files[0].webkitRelativePath.split("/")[0]
      : files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : `${files.length} songs`;
    const playlist = await useLocalStore.getState().addFiles(files, name);
    e.target.value = ""; // allow picking the same files again
    show(playlist);
  };

  return (
    <nav className="sidebar-nav">
      <p className="nav-label">LOCAL MUSIC</p>
      <div className="local-actions">
        <button className="local-btn" onClick={handleAddFolder}>📁 Add folder</button>
        <button className="local-btn" onClick={() => filesInput.current.click()}>🎵 Open files</button>
      </div>
      <input ref={filesInput} type="file" accept={AUDIO_ACCEPT} multiple hidden
        onChange={(e) => handleInput(e, false)} />
      <input ref={folderInput} type="file" webkitdirectory="" multiple hidden
        onChange={(e) => handleInput(e, true)} />

      {loading && (
        <p className="empty-label">
          Reading songs{loading.total ? ` ${loading.done}/${loading.total}` : ""}…
        </p>
      )}
      {error && <p className="import-error">{error}</p>}

      {folders.map((folder) => {
        const playlist = playlists[folder.id];
        return (
          <div key={folder.id} className="playlist-item-row">
            <button
              className={`playlist-item ${selected?.id === `local:${folder.id}` ? "active" : ""}`}
              onClick={async () => show(await useLocalStore.getState().openFolder(folder))}
              disabled={loading?.folderId === folder.id}
            >
              {playlist?.cover_url
                ? <img src={playlist.cover_url} alt="" className="playlist-thumb" />
                : <div className="folder-thumb">📁</div>}
              <div className="playlist-info">
                <span className="playlist-name">{folder.name}</span>
                <span className="playlist-owner">
                  {playlist ? `${playlist.tracks.length} songs` : folder.handle ? "Local folder" : "Opened this session"}
                </span>
              </div>
            </button>
            <button
              className="remove-btn"
              title="Remove from sidebar (files stay on disk)"
              onClick={() => useLocalStore.getState().removeFolder(folder)}
            >
              ×
            </button>
          </div>
        );
      })}
    </nav>
  );
}
