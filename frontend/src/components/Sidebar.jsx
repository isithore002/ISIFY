import { usePlayerStore } from "../store/playerStore";
import LibrarySection from "./LibrarySection";

// Nav items with no page behind them yet — say so on click instead of doing nothing
const UNBUILT_NAV_IDS = new Set(["radio", "artist", "albums"]);

export default function Sidebar({
  selectedNav,
  onSelectNav,
  selectedPlaylist,
  onSelectPlaylist,
  onOpenImport,
}) {
  const showToast = usePlayerStore((s) => s.showToast);

  const navItems = [
    {
      id: "discover",
      label: "Discover",
      icon: (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" />
          <rect x="11.5" y="2" width="6.5" height="6.5" rx="1.5" />
          <rect x="2" y="11.5" width="6.5" height="6.5" rx="1.5" />
          <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
        </svg>
      ),
    },
    {
      id: "trends",
      label: "Trends",
      icon: (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5l7-3 7 3-7 3-7-3z" />
          <path d="M3 10l7 3 7-3" />
          <path d="M3 15l7 3 7-3" />
        </svg>
      ),
    },
    {
      id: "genres",
      label: "Genres",
      icon: (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h12M4 11h8M4 16h10" />
          <circle cx="16" cy="11" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "radio",
      label: "Radio",
      icon: (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="16" height="12" rx="2" />
          <circle cx="7" cy="11" r="2.5" />
          <line x1="12" y1="9" x2="16" y2="9" />
          <line x1="12" y1="13" x2="16" y2="13" />
        </svg>
      ),
    },
    {
      id: "artist",
      label: "Artist",
      icon: (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="10" cy="6" r="3.5" />
          <path d="M3.5 17c0-3.5 3-5 6.5-5s6.5 1.5 6.5 5" />
        </svg>
      ),
    },
    {
      id: "albums",
      label: "Albums",
      icon: (
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="10" cy="10" r="7" />
          <circle cx="10" cy="10" r="2.5" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="sidebar">
      {/* ── Brand Logo ── */}
      <div
        className="sidebar-brand"
        onClick={() => {
          onSelectNav("discover");
          onSelectPlaylist(null);
        }}
      >
        <div className="brand-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 18V5l12-2v13"
              stroke="#1ed760"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6" cy="18" r="3.5" fill="#1ed760" />
            <circle cx="18" cy="16" r="3.5" fill="#1ed760" />
          </svg>
        </div>
        <span className="brand-name">ISIFY</span>
      </div>

      {/* ── Primary Navigation ── */}
      <nav className="nav-menu">
        {navItems.map((item) => {
          const isActive = selectedNav === item.id && !selectedPlaylist;
          return (
            <button
              key={item.id}
              className={`nav-menu-item ${isActive ? "active" : ""}`}
              onClick={() => {
                onSelectNav(item.id);
                onSelectPlaylist(null);
                // "Discover" and "Trends" show/scroll to real content; the rest have no
                // page behind them yet, so say so rather than just lighting up and stopping
                if (UNBUILT_NAV_IDS.has(item.id)) showToast(`${item.label} — coming soon`);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              {isActive && <span className="nav-active-bar" />}
            </button>
          );
        })}
      </nav>

      {/* ── My Library ── */}
      <LibrarySection
        selectedPlaylist={selectedPlaylist}
        onSelectPlaylist={onSelectPlaylist}
        onOpenImport={onOpenImport}
      />
    </aside>
  );
}
