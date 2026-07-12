import { useState } from 'react';
import ReadBooks from './pages/ReadBooks.jsx';
import AuthorSearch from './pages/AuthorSearch.jsx';
import Mindmap from './pages/Mindmap.jsx';

const TABS = [
  { id: 'library', label: '📚 Ma bibliothèque' },
  { id: 'search', label: '🔎 Recherche d\'auteur' },
  { id: 'mindmap', label: '🗺️ Mindmap' },
];

export default function App() {
  const [tab, setTab] = useState('library');

  return (
    <main className="container">
      <h1>📚 Biblio</h1>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'library' && <ReadBooks />}
      {tab === 'search' && <AuthorSearch />}
      {tab === 'mindmap' && <Mindmap />}
    </main>
  );
}
