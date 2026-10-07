import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { importPlaylist } from "../api/playlist";
import { searchYouTube } from "../api/search";
import { useLibraryStore } from "../store/libraryStore";
import { usePlayerStore } from "../store/playerStore";

function formatDuration(ms) {
  if (!ms) return "";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function TopNav({
  activeTab,
  onTabChange,
  onSelectPlaylist,
  onSearchResults,
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchWrapRef = useRef(null);
  // The query last submitted with Enter. Live suggestions for it must not appear afterwards:
  // the as-you-type search fires ~380 ms after the last keystroke, so pressing Enter quickly
  // (a phone keyboard's Go key invites that) let it finish later and reopen the dropdown on
  // top of the results page.
  const submittedRef = useRef(null);
  const showToast = usePlayerStore((s) => s.showToast);
  const store = usePlayerStore();

  const isUrl = (text) =>
    /https?:\/\/(open\.spotify\.com|spotify\.link|www\.youtube\.com|youtu\.be|music\.apple\.com|soundcloud\.com)/i.test(
      text
    );

  const importMut = useMutation({
    mutationFn: importPlaylist,
    onSuccess: (data) => {
      useLibraryStore.getState().add(data);
      onSelectPlaylist(data);
      setQuery("");
      setShowDropdown(false);
      showToast(`Imported: ${data.name}`);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || err.message || "Import failed");
    },
  });

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    submittedRef.current = null; // typing again brings live suggestions back
    if (val.trim().length < 2 || isUrl(val.trim())) {
      setSearchResults([]);
      setIsSearching(false);
      setShowDropdown(false);
    }
  };

  // Debounced search on typing
  useEffect(() => {
    const val = query.trim();
    if (val.length < 2 || isUrl(val)) {
      return;
    }

    const timer = setTimeout(async () => {
      if (submittedRef.current === val) return; // already submitted — no suggestions needed
      setIsSearching(true);
      try {
        const results = await searchYouTube(val);
        if (submittedRef.current === val) return; // submitted while this was in flight
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 380);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handlePlayResult = (track) => {
    store.playFromSearch(track, query);
    setShowDropdown(false);
    showToast(`Playing from YouTube: ${track.title}`);
    onSearchResults?.({ query, results: searchResults });
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const val = query.trim();
    if (!val) return;

    if (isUrl(val)) {
      importMut.mutate(val);
      return;
    }

    // Direct YouTube search and play
    submittedRef.current = val;
    setShowDropdown(false);
    document.activeElement?.blur?.(); // puts the phone keyboard away so the results are visible
    setIsSearching(true);
    try {
      showToast(`Searching YouTube for "${val}"…`);
      const results = await searchYouTube(val);
      if (results && results.length > 0) {
        setSearchResults(results);
        // Play the top result immediately!
        store.playFromSearch(results[0], val);
        showToast(`Playing "${results[0].title}" from YouTube!`);
        onSearchResults?.({ query: val, results });
      } else {
        showToast(`No YouTube results found for "${val}"`);
      }
    } catch (err) {
      showToast(`YouTube search error: ${err.message}`);
    } finally {
      setIsSearching(false);
      setShowDropdown(false);
    }
  };

  const tabs = [
    { id: "discover", label: "Discover" },
    { id: "popular", label: "Popular" },
    { id: "latest", label: "Latest" },
    { id: "trending", label: "Trending" },
  ];

  return (
    <header className="top-nav">
      {/* Brand mark — phones only (the sidebar that normally carries it is hidden there) */}
      <div className="top-nav-brand" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M9 18V5l12-2v13" stroke="#1ed760" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3.5" fill="#1ed760" />
          <circle cx="18" cy="16" r="3.5" fill="#1ed760" />
        </svg>
      </div>

      {/* Navigation tabs */}
      <div className="top-nav-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`top-nav-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => {
              onTabChange(tab.id);
              // "Popular"/"Trending" scroll to the matching section on Discover; "Latest"
              // has no page of its own yet, so say so instead of pretending it did something
              if (tab.id === "latest") showToast("Latest — coming soon");
            }}
          >
            {tab.label}
            {activeTab === tab.id && <span className="tab-indicator" />}
          </button>
        ))}
      </div>

      {/* Search pill + Live Results Dropdown */}
      <div className="search-wrap" ref={searchWrapRef}>
        <form onSubmit={handleSearchSubmit} className="top-nav-search-form">
          <div className="search-pill">
            <input
              type="text"
              className="search-input"
              placeholder={
                importMut.isPending
                  ? "Importing from URL…"
                  : isSearching
                  ? "Searching YouTube…"
                  : "Search any song on YouTube…"
              }
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              disabled={importMut.isPending}
            />
            <button type="submit" className="search-btn" title="Search on YouTube and play">
              {importMut.isPending || isSearching ? (
                <span className="search-spinner">⏳</span>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Live Search Floating Popover */}
        {showDropdown && searchResults.length > 0 && (
          <div className="search-dropdown-popover">
            <div className="dropdown-header">
              <span>YOUTUBE RESULTS</span>
              <span className="dropdown-count">{searchResults.length} songs</span>
            </div>

            <div className="dropdown-list">
              {searchResults.map((track) => (
                <div
                  key={track.id || track.yt_video_id}
                  className="dropdown-item"
                  onClick={() => handlePlayResult(track)}
                >
                  <div className="dropdown-art-wrap">
                    {track.cover_url ? (
                      <img src={track.cover_url} alt={track.title} className="dropdown-art" />
                    ) : (
                      <div className="dropdown-art dropdown-art-fallback">🎵</div>
                    )}
                    <span className="dropdown-play-icon">▶</span>
                  </div>

                  <div className="dropdown-info">
                    <span className="dropdown-title" title={track.title}>{track.title}</span>
                    <span className="dropdown-artist">{track.artist}</span>
                  </div>

                  <span className="dropdown-duration">{formatDuration(track.duration_ms)}</span>
                </div>
              ))}
            </div>

            <div className="dropdown-footer">
              <span>Press <strong>Enter</strong> to play top match instantly</span>
            </div>
          </div>
        )}
      </div>

      {/* Right icons & profile */}
      <div className="top-nav-user-actions">
        {/* Messages */}
        <button className="nav-icon-btn" title="Messages" aria-label="Messages">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>

        {/* Notifications with badge */}
        <button className="nav-icon-btn notif-btn" title="Notifications" aria-label="Notifications">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="notif-badge" />
        </button>

        {/* User avatar with green online badge */}
        <div className="user-profile-badge" title="User Profile">
          <img
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop"
            alt="Profile"
            className="user-avatar"
          />
          <span className="online-dot" />
        </div>
      </div>
    </header>
  );
}
