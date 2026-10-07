import { useState, useRef, useEffect } from "react";
import { HERO_ARTIST, TRENDY_SONGS, POPULAR_SONGS } from "../data/mockMusfluentData";
import { usePlayerStore } from "../store/playerStore";
import { useLikeStore } from "../store/likeStore";
import { downloadTrack, trackErrorMessage, warmOnHover } from "../api/track";
import { cacheTrack } from "../hooks/useOfflineCache";
import TrackMenu from "./TrackMenu";
import GenreSection from "./GenreSection";
import { HeartIcon, QueueAddIcon, MoreIcon } from "./icons";

export default function DiscoverView({ activeTab, selectedNav, onOpenGenre }) {
  const store = usePlayerStore();
  const { isLiked, toggleLike } = useLikeStore();

  // Context menu state — the list is tracked alongside the track so "Play now" can look
  // it up in the right source list (a Trendy card and a Popular row can share a track id
  // only by coincidence, but the two lists are never searched interchangeably)
  const [activeMenuTrack, setActiveMenuTrack] = useState(null);
  const [activeMenuList, setActiveMenuList] = useState("popular");
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [downloadingId, setDownloadingId] = useState(null);
  const [cachingId, setCachingId] = useState(null);

  const trendyRef = useRef(null);
  const popularRef = useRef(null);
  const genresRef = useRef(null);

  // TopNav's "Popular"/"Trending" tabs and the sidebar's "Trends" item have no separate
  // page of their own — they bring the matching section on this page into view instead.
  useEffect(() => {
    if (activeTab === "popular") popularRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (activeTab === "trending") trendyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab]);

  useEffect(() => {
    if (selectedNav === "trends") trendyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (selectedNav === "genres") genresRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedNav]);

  const handlePlayHero = () => {
    const allTracks = [HERO_ARTIST.featuredSong, ...POPULAR_SONGS, ...TRENDY_SONGS];
    store.setQueue(allTracks, 0, null, `Artist · ${HERO_ARTIST.name}`);
    store.setPlaying(true);
  };

  const handlePlayTrack = (track, listName) => {
    const list = listName === "trendy" ? TRENDY_SONGS : POPULAR_SONGS;
    const index = list.findIndex((t) => t.id === track.id);
    store.setQueue(list, index >= 0 ? index : 0, null, listName === "trendy" ? "Trendy Songs" : "Popular Songs");
    store.setPlaying(true);
  };

  const openTrackMenu = (e, track, list) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ x: rect.right - 200, y: rect.bottom + 4 });
    setActiveMenuTrack(track);
    setActiveMenuList(list);
  };

  const handleDownload = async (track) => {
    setDownloadingId(track.id);
    try {
      await downloadTrack(track);
      store.showToast(`Downloaded: ${track.title}`);
    } catch (err) {
      store.showToast(await trackErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCache = async (track) => {
    setCachingId(track.id);
    try {
      await cacheTrack(track);
      store.showToast(`Saved offline: ${track.title}`);
    } catch (err) {
      store.showToast(await trackErrorMessage(err));
    } finally {
      setCachingId(null);
    }
  };

  const currentTrack = store.currentTrack();

  return (
    <div className="discover-view">
      {/* ── Featured Hero Banner ── */}
      <section className="hero-banner">
        <div className="hero-content">
          <div className="verified-badge">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="#3897f0">
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
            </svg>
            <span>Verified Artist</span>
          </div>

          <h1 className="hero-artist-name">{HERO_ARTIST.name}</h1>

          <div className="hero-listeners">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 1a7 7 0 0 0-7 7v4.5A2.5 2.5 0 0 0 3.5 15h1a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 4.5 9H2.5V8a5.5 5.5 0 0 1 11 0v1H11.5A1.5 1.5 0 0 0 10 10.5v3a1.5 1.5 0 0 0 1.5 1.5h1A2.5 2.5 0 0 0 15 12.5V8a7 7 0 0 0-7-7z" />
            </svg>
            <span>{HERO_ARTIST.monthlyListeners}</span>
          </div>

          <button className="hero-listen-btn" onClick={handlePlayHero}>
            <span className="hero-btn-icon">▶</span>
            <span>Listen Now</span>
          </button>
        </div>

        {/* Hero image cutout */}
        <div className="hero-image-wrap">
          <img
            src={HERO_ARTIST.bannerImage}
            alt={HERO_ARTIST.name}
            className="hero-image"
          />
        </div>
      </section>

      {/* ── Trendy Songs Section ── */}
      <section className="trendy-section" ref={trendyRef}>
        <div className="section-header">
          <h2 className="section-title">Trendy Songs</h2>
          <div className="carousel-nav">
            <button className="nav-arrow-btn" title="Previous songs" aria-label="Previous trendy songs" disabled>
              ‹
            </button>
            <button className="nav-arrow-btn" title="Next songs" aria-label="Next trendy songs" disabled>
              ›
            </button>
          </div>
        </div>

        <div className="trendy-grid">
          {TRENDY_SONGS.map((song) => {
            const isPlayingThis = currentTrack?.id === song.id && store.playing;
            const liked = isLiked(song.id);

            return (
              <div
                key={song.id}
                className={`trendy-card ${currentTrack?.id === song.id ? "current-card" : ""}`}
                onClick={() => handlePlayTrack(song, "trendy")}
                {...warmOnHover(song)}
              >
                <div className="trendy-art-wrap">
                  <img src={song.cover_url} alt={song.title} className="trendy-art" />
                  <div className="trendy-play-overlay">
                    <span className="trendy-play-icon">{isPlayingThis ? "⏸" : "▶"}</span>
                  </div>
                </div>

                <div className="trendy-meta">
                  <span className="trendy-title" title={song.title}>{song.title}</span>
                  <span className="trendy-artist" title={song.artist}>{song.artist}</span>
                </div>

                {/* Bottom action row mirroring the screenshot */}
                <div className="trendy-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`card-action-btn like-btn ${liked ? "liked" : ""}`}
                    onClick={() => toggleLike(song.id)}
                    title={liked ? "Remove from Liked" : "Add to Liked"}
                    aria-label={liked ? "Remove from Liked" : "Add to Liked"}
                    aria-pressed={liked}
                  >
                    <HeartIcon filled={liked} />
                  </button>

                  <button
                    className="card-action-btn"
                    onClick={() => store.addToQueue(song)}
                    title="Add to queue"
                    aria-label="Add to queue"
                  >
                    <QueueAddIcon />
                  </button>

                  <button
                    className="card-action-btn"
                    onClick={(e) => openTrackMenu(e, song, "trendy")}
                    title="More options"
                    aria-label="More options"
                  >
                    <MoreIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Browse by Genre (Tamil / English) ── */}
      <div ref={genresRef}>
        <GenreSection onOpenGenre={onOpenGenre} />
      </div>

      {/* ── Popular Section ── */}
      <section className="popular-section" ref={popularRef}>
        <div className="section-header">
          <h2 className="section-title">Popular</h2>
          <button
            className="see-all-link"
            onClick={() => {
              store.setQueue(POPULAR_SONGS, 0, null, "Popular Hits");
              store.setPlaying(true);
            }}
          >
            See All
          </button>
        </div>

        <div className="popular-header" aria-hidden="true">
          <span>#</span>
          <span></span>
          <span>Title</span>
          <span>Plays</span>
          <span>Time</span>
          <span></span>
        </div>

        <div className="popular-list">
          {POPULAR_SONGS.map((song, idx) => {
            const isPlayingThis = currentTrack?.id === song.id && store.playing;
            const liked = isLiked(song.id);

            return (
              <div
                key={song.id}
                className={`popular-row ${currentTrack?.id === song.id ? "current" : ""}`}
                onClick={() => handlePlayTrack(song, "popular")}
                {...warmOnHover(song)}
              >
                <div className="popular-rank">
                  {isPlayingThis ? (
                    <span className="playing-accent-icon">▶</span>
                  ) : (
                    <span>#{idx + 1}</span>
                  )}
                </div>

                <div className="popular-art-wrap">
                  <img src={song.cover_url} alt={song.title} className="popular-art" />
                </div>

                <div className="popular-info">
                  <span className="popular-title">{song.title}</span>
                  <span className="popular-artist">{song.artist}</span>
                </div>

                <div className="popular-plays">{song.plays}</div>

                <div className="popular-duration">
                  <span className="clock-icon">⏱</span>
                  <span>{song.durationText}</span>
                </div>

                <div className="popular-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className={`card-action-btn like-btn ${liked ? "liked" : ""}`}
                    onClick={() => toggleLike(song.id)}
                    title={liked ? "Remove from Liked" : "Add to Liked"}
                    aria-label={liked ? "Remove from Liked" : "Add to Liked"}
                    aria-pressed={liked}
                  >
                    <HeartIcon filled={liked} />
                  </button>

                  <button
                    className="card-action-btn"
                    onClick={(e) => openTrackMenu(e, song, "popular")}
                    title="More options"
                    aria-label="More options"
                  >
                    <MoreIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Reusable TrackMenu */}
      {activeMenuTrack && (
        <TrackMenu
          isOpen={Boolean(activeMenuTrack)}
          position={menuPos}
          track={activeMenuTrack}
          onClose={() => setActiveMenuTrack(null)}
          onPlayNow={() => handlePlayTrack(activeMenuTrack, activeMenuList)}
          onPlayNext={() => store.playNext(activeMenuTrack)}
          onAddToQueue={() => store.addToQueue(activeMenuTrack)}
          onDownload={() => handleDownload(activeMenuTrack)}
          onCache={() => handleCache(activeMenuTrack)}
          isDownloading={downloadingId === activeMenuTrack.id}
          isCaching={cachingId === activeMenuTrack.id}
        />
      )}
    </div>
  );
}
