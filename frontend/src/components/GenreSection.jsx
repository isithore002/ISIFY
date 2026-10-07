import { useState } from "react";
import { GENRE_LANGUAGES } from "../data/genres";
import { searchYouTube } from "../api/search";
import { usePlayerStore } from "../store/playerStore";

const LANG_KEY = "wv_genre_lang";
const SONGS_PER_GENRE = 25;

function initialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (GENRE_LANGUAGES.some((l) => l.id === saved)) return saved;
  } catch { /* storage blocked — fall back to the first tab */ }
  return GENRE_LANGUAGES[0].id;
}

// "Browse by Genre": a Tamil / English switch over a grid of genre cards. Opening a card searches
// YouTube for that genre and hands the songs up to be shown as a page of their own.
export default function GenreSection({ onOpenGenre }) {
  const showToast = usePlayerStore((s) => s.showToast);
  const [languageId, setLanguageId] = useState(initialLanguage);
  const [loadingId, setLoadingId] = useState(null);

  const language = GENRE_LANGUAGES.find((l) => l.id === languageId) ?? GENRE_LANGUAGES[0];

  const pickLanguage = (id) => {
    setLanguageId(id);
    try { localStorage.setItem(LANG_KEY, id); } catch { /* not remembered */ }
  };

  const open = async (genre) => {
    if (loadingId) return; // one lookup at a time; a second tap would just race the first
    setLoadingId(genre.id);
    try {
      const results = await searchYouTube(genre.query, { limit: SONGS_PER_GENRE, songsOnly: true });
      if (!results.length) {
        showToast(`No ${language.label} ${genre.name} songs found — try another genre`);
        return;
      }
      onOpenGenre({
        query: genre.query,
        results,
        genre: { name: genre.name, emoji: genre.emoji, hue: genre.hue, language: language.label },
      });
    } catch (err) {
      showToast(`Couldn't load ${genre.name}: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="genre-section" id="genres">
      <div className="section-header">
        <h2 className="section-title">Browse by Genre</h2>
        <div className="genre-tabs" role="tablist" aria-label="Song language">
          {GENRE_LANGUAGES.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === language.id}
              className={`genre-tab ${l.id === language.id ? "active" : ""}`}
              onClick={() => pickLanguage(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="genre-grid" role="tabpanel">
        {language.genres.map((genre) => {
          const loading = loadingId === genre.id;
          return (
            <button
              key={genre.id}
              className={`genre-card ${loading ? "loading" : ""}`}
              style={{ "--hue": genre.hue }}
              onClick={() => open(genre)}
              disabled={Boolean(loadingId) && !loading}
              aria-busy={loading}
              title={`${language.label} · ${genre.name}`}
            >
              <span className="genre-name">{genre.name}</span>
              <span className="genre-emoji" aria-hidden="true">{loading ? "⏳" : genre.emoji}</span>
              <span className="genre-lang">{loading ? "Finding songs…" : language.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
