import { useEffect, useMemo, useState } from 'react';
import { readApi } from '../api.js';

// Sélecteur de note à 5 étoiles. Cliquer sur l'étoile courante remet à zéro.
function Stars({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star ${n <= (value || 0) ? 'on' : ''}`}
          title={`${n}/5`}
          onClick={() => onChange(n === value ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// Carte d'un livre lu : note + thèmes éditables.
function ReadCard({ read, onChange, onRemove }) {
  const [tag, setTag] = useState('');

  function addTag(e) {
    e.preventDefault();
    const t = tag.trim();
    setTag('');
    if (!t || read.themes.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange(read.id, { themes: [...read.themes, t] });
  }

  function removeTag(name) {
    onChange(read.id, { themes: read.themes.filter((x) => x !== name) });
  }

  return (
    <li className="card read-card">
      <div className="read-head">
        <div>
          <strong>{read.title}</strong>
          <span className="meta">
            {read.author}
            {read.year ? ` · ${read.year}` : ''} · lu le {read.readDate}
          </span>
        </div>
        <button className="danger" onClick={() => onRemove(read.id)}>
          Retirer
        </button>
      </div>

      <div className="read-body">
        <div className="field">
          <span className="field-label">Note</span>
          <Stars value={read.rating} onChange={(r) => onChange(read.id, { rating: r })} />
        </div>

        <div className="field">
          <span className="field-label">Thèmes</span>
          <div className="tags">
            {read.themes.map((t) => (
              <span key={t} className="tag">
                {t}
                <button type="button" onClick={() => removeTag(t)} aria-label="Retirer">
                  ×
                </button>
              </span>
            ))}
            <form className="tag-form" onSubmit={addTag}>
              <input
                list="theme-suggestions"
                placeholder="policier, 19e siècle…"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
              <button type="submit">+</button>
            </form>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function ReadBooks() {
  const [reads, setReads] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Filtres et tri
  const [query, setQuery] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('recent');

  useEffect(() => {
    readApi
      .list()
      .then(setReads)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function update(id, patch) {
    setError('');
    try {
      const updated = await readApi.update(id, patch);
      setReads((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    setError('');
    try {
      await readApi.remove(id);
      setReads((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  // Thèmes déjà utilisés (pour le filtre et l'autocomplétion).
  const suggestions = useMemo(
    () => [...new Set(reads.flatMap((r) => r.themes))].sort(),
    [reads]
  );

  // Application de la recherche, des filtres et du tri.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = reads.filter((r) => {
      const matchesText =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.author.toLowerCase().includes(q);
      const matchesTheme = !themeFilter || r.themes.includes(themeFilter);
      const matchesRating = (r.rating || 0) >= minRating;
      return matchesText && matchesTheme && matchesRating;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
      // 'recent' : par date de lecture décroissante
      return (b.readDate || '').localeCompare(a.readDate || '');
    });
    return list;
  }, [reads, query, themeFilter, minRating, sortBy]);

  const hasActiveFilters = query || themeFilter || minRating > 0;

  function resetFilters() {
    setQuery('');
    setThemeFilter('');
    setMinRating(0);
    setSortBy('recent');
  }

  return (
    <section>
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Chargement…</p>
      ) : reads.length === 0 ? (
        <p>
          Aucun livre lu pour le moment. Cochez « Lu » sur des œuvres depuis
          l'onglet « Recherche d'auteur ».
        </p>
      ) : (
        <>
          <div className="card filters">
            <input
              className="filter-search"
              type="search"
              placeholder="Rechercher un titre ou un auteur…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label>
              Thème
              <select
                value={themeFilter}
                onChange={(e) => setThemeFilter(e.target.value)}
              >
                <option value="">Tous</option>
                {suggestions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note min.
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
              >
                <option value={0}>Toutes</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)} et +
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trier par
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recent">Lu récemment</option>
                <option value="title">Titre (A→Z)</option>
                <option value="author">Auteur (A→Z)</option>
                <option value="rating">Note (élevée→basse)</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button className="reset-btn" onClick={resetFilters}>
                Réinitialiser
              </button>
            )}
          </div>

          <p className="result-count">
            {filtered.length} livre{filtered.length > 1 ? 's' : ''}
            {hasActiveFilters ? ` sur ${reads.length}` : ''}
          </p>

          <datalist id="theme-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {filtered.length === 0 ? (
            <p>Aucun livre ne correspond à ces critères.</p>
          ) : (
            <ul className="list">
              {filtered.map((r) => (
                <ReadCard key={r.id} read={r} onChange={update} onRemove={remove} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
