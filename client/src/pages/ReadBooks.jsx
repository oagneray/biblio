import { useEffect, useState } from 'react';
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

  // Suggestions de thèmes déjà utilisés (pour l'autocomplétion).
  const suggestions = [...new Set(reads.flatMap((r) => r.themes))].sort();

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
          <datalist id="theme-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <ul className="list">
            {reads.map((r) => (
              <ReadCard key={r.id} read={r} onChange={update} onRemove={remove} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
