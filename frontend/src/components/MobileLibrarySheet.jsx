import LibrarySection from "./LibrarySection";
import { ChevronDownIcon } from "./icons";

// The phone's "Library" tab: the same playlists / folders / create-and-import controls as the
// desktop sidebar, in a full-screen sheet with room for thumb-sized rows.
export default function MobileLibrarySheet({ isOpen, onClose, selectedPlaylist, onSelectPlaylist, onOpenImport }) {
  if (!isOpen) return null;

  return (
    <div className="m-sheet m-library" role="dialog" aria-label="Your library">
      <header className="m-sheet-header">
        <button className="m-sheet-close" onClick={onClose} aria-label="Close library">
          <ChevronDownIcon />
        </button>
        <h2>Your Library</h2>
      </header>
      <div className="m-sheet-body">
        <LibrarySection
          selectedPlaylist={selectedPlaylist}
          onSelectPlaylist={(playlist) => {
            onSelectPlaylist(playlist);
            if (playlist) onClose(); // opening a playlist takes you to it
          }}
          onOpenImport={() => {
            onClose();
            onOpenImport();
          }}
        />
      </div>
    </div>
  );
}
