import { useState } from 'react';
import { authorsApi, readApi } from '../api.js';

// URL d'une miniature de couverture Open Library à partir de son identifiant.
const coverUrl = (id) =>
  id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null;

// Extrait une année (4 chiffres) depuis une chaîne Open Library
// (ex : "3 January 1892" -> 1892, "1951" -> 1951).
const parseYear = (str) => {
  const m = String(str ?? '').match(/\d{4}/);
  return m ? Number(m[0]) : null;
};

export default function AuthorSearch() {
  const [query, setQuery] = useState('');
  const [authors, setAuthors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [works, setWorks] = useState([]);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [readMap, setReadMap] = useState({}); // id d'œuvre -> id de lecture (read_books)
  const [pendingId, setPendingId] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError('');
    setSearching(true);
    setSelected(null);
    setWorks([]);
    try {
      setAuthors(await authorsApi.search(q));
    } catch (e) {
      setError(e.message);
      setAuthors([]);
    } finally {
      setSearching(false);
    }
  }

  async function openWorks(author) {
    setSelected(author);
    setError('');
    setLoadingWorks(true);
    setWorks([]);
    setReadMap({});
    try {
      // On charge en parallèle la bibliographie et les livres déjà lus,
      // afin de pré-cocher les œuvres correspondantes.
      const [data, reads] = await Promise.all([
        authorsApi.works(author.id),
        readApi.list(),
      ]);
      const map = {};
      for (const w of data.works) {
        const match = reads.find(
          (r) =>
            r.author.toLowerCase() === author.name.toLowerCase() &&
            r.title.toLowerCase() === w.title.toLowerCase()
        );
        if (match) map[w.id] = match.id;
      }
      setWorks(data.works);
      setReadMap(map);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingWorks(false);
    }
  }

  // Coche/décoche « Lu » : enregistre (ou retire) la lecture dans read_books.
  async function toggleRead(work) {
    if (!selected) return;
    setError('');
    setPendingId(work.id);
    try {
      if (readMap[work.id]) {
        await readApi.remove(readMap[work.id]);
        setReadMap((prev) => {
          const next = { ...prev };
          delete next[work.id];
          return next;
        });
      } else {
        const { readId } = await readApi.markWork({
          title: work.title,
          author: selected.name,
          birthYear: parseYear(selected.birthDate),
          year: parseYear(work.firstPublished),
        });
        setReadMap((prev) => ({ ...prev, [work.id]: readId }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section>
      <form className="card form" onSubmit={handleSearch}>
        <input
          placeholder="Rechercher un auteur (ex : Tolkien)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: '1 1 240px' }}
        />
        <button type="submit" disabled={searching}>
          {searching ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {/* Résultats de la recherche d'auteurs */}
      {authors.length > 0 && (
        <ul className="list">
          {authors.map((a) => (
            <li
              key={a.id}
              className={`card book ${selected?.id === a.id ? 'selected' : ''}`}
            >
              <div>
                <strong>{a.name}</strong>
                <span className="meta">
                  {a.birthDate ? `Né(e) : ${a.birthDate} · ` : ''}
                  {a.workCount} œuvre{a.workCount > 1 ? 's' : ''}
                  {a.topWork ? ` · « ${a.topWork} »` : ''}
                </span>
              </div>
              <div className="actions">
                <button onClick={() => openWorks(a)}>Voir la bibliographie</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Bibliographie de l'auteur sélectionné */}
      {selected && (
        <div style={{ marginTop: '1.5rem' }}>
          <h2>Œuvres de {selected.name}</h2>
          {loadingWorks ? (
            <p>Chargement de la bibliographie…</p>
          ) : works.length === 0 ? (
            <p>Aucune œuvre trouvée.</p>
          ) : (
            <ul className="works">
              {works.map((w) => (
                <li key={w.id} className="card work">
                  {coverUrl(w.coverId) ? (
                    <img src={coverUrl(w.coverId)} alt="" className="cover" />
                  ) : (
                    <div className="cover cover--empty">📖</div>
                  )}
                  <span className="work-title">{w.title}</span>
                  {w.firstPublished && (
                    <span className="meta">{w.firstPublished}</span>
                  )}
                  <label className="read-check">
                    <input
                      type="checkbox"
                      checked={!!readMap[w.id]}
                      disabled={pendingId === w.id}
                      onChange={() => toggleRead(w)}
                    />
                    {pendingId === w.id ? '…' : 'Lu'}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
