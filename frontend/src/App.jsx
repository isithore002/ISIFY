import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import DiscoverView from "./components/DiscoverView";
import TrackList from "./components/TrackList";
import SearchResultsView from "./components/SearchResultsView";
import RightSidebar from "./components/RightSidebar";
import Player from "./components/Player";
import QueueDrawer from "./components/QueueDrawer";
import MobileTabBar from "./components/MobileTabBar";
import MobileLibrarySheet from "./components/MobileLibrarySheet";
import ImportModal from "./components/ImportModal";
import Toast from "./components/Toast";
import DebugPanel from "./components/DebugPanel";
import { debugEnabled } from "./lib/debugLog";
import "./App.css";
import "./mobile.css";

const queryClient = new QueryClient();

function AppInner() {
  const [activeTab, setActiveTab] = useState("discover");
  const [selectedNav, setSelectedNav] = useState("discover");
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [searchData, setSearchData] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false); // the phone's Library tab

  const handleSelectNav = (navId) => {
    setSelectedNav(navId);
    setActivePlaylist(null);
    setSearchData(null);
  };

  const handleSelectPlaylist = (playlist) => {
    setActivePlaylist(playlist);
    setSearchData(null);
  };

  const handleSearchResults = (data) => {
    setSearchData(data);
    setActivePlaylist(null);
  };

  // A results or playlist page opens at its top, not at wherever the page behind it was scrolled
  useEffect(() => {
    if (searchData || activePlaylist) document.querySelector(".main-scroll-body")?.scrollTo({ top: 0 });
  }, [searchData, activePlaylist]);

  // A genre opens as a page of its own; "back" lands on the genre list it came from
  const handleOpenGenre = (data) => {
    setSelectedNav("genres");
    handleSearchResults(data);
  };

  // Phone tab bar: which tab is lit, and what each one does
  const mobileTab = isLibraryOpen || activePlaylist
    ? "library"
    : searchData && !searchData.genre ? "search" : "home";

  const goHome = () => {
    setIsLibraryOpen(false);
    setActiveTab("discover");
    handleSelectNav("discover");
    document.querySelector(".main-scroll-body")?.scrollTo({ top: 0 });
  };

  const goSearch = () => {
    setIsLibraryOpen(false);
    document.querySelector(".main-scroll-body")?.scrollTo({ top: 0 });
    document.querySelector(".search-input")?.focus();
  };

  return (
    <div className="app-shell">
      {/* ── Left Sidebar ── */}
      <Sidebar
        selectedNav={selectedNav}
        onSelectNav={handleSelectNav}
        selectedPlaylist={activePlaylist}
        onSelectPlaylist={handleSelectPlaylist}
        onOpenImport={() => setIsImportModalOpen(true)}
      />

      {/* ── Center Main Content ── */}
      <main className="main-content">
        <TopNav
          // the tabs describe the Discover page; on a playlist or search page none is current
          activeTab={activePlaylist || searchData ? null : activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setActivePlaylist(null);
            setSearchData(null);
          }}
          onSelectPlaylist={handleSelectPlaylist}
          onSearchResults={handleSearchResults}
        />

        <div className="main-scroll-body">
          {searchData ? (
            <SearchResultsView
              query={searchData.query}
              results={searchData.results}
              genre={searchData.genre}
              onBack={() => setSearchData(null)}
            />
          ) : activePlaylist ? (
            <TrackList
              playlist={activePlaylist}
              onSelect={handleSelectPlaylist}
            />
          ) : (
            <DiscoverView activeTab={activeTab} selectedNav={selectedNav} onOpenGenre={handleOpenGenre} />
          )}
        </div>
      </main>

      {/* ── Right Sidebar (Friends & VIP Promo) ── */}
      <RightSidebar onOpenImport={() => setIsImportModalOpen(true)} />

      {/* ── Interactive Queue Drawer ── */}
      <QueueDrawer />

      {/* ── Bottom Neon Player Bar ── */}
      <Player />

      {/* ── Phone navigation (hidden on wide screens) ── */}
      <MobileTabBar
        active={mobileTab}
        onHome={goHome}
        onSearch={goSearch}
        onLibrary={() => setIsLibraryOpen(true)}
        onAdd={() => setIsImportModalOpen(true)}
      />
      <MobileLibrarySheet
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        selectedPlaylist={activePlaylist}
        onSelectPlaylist={handleSelectPlaylist}
        onOpenImport={() => setIsImportModalOpen(true)}
      />

      {/* ── Global Modals & Notifications ── */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSelectPlaylist={handleSelectPlaylist}
      />
      <Toast />
      {debugEnabled && <DebugPanel />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
