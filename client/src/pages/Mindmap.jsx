import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import { readApi } from '../api.js';

// --- Styles des nœuds ------------------------------------------------------
const CENTER_STYLE = {
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: 14,
  padding: '12px 18px',
  fontWeight: 700,
  fontSize: 15,
  textAlign: 'center',
  width: 170,
};
const GROUP_STYLE = {
  background: '#eef2ff',
  color: '#3730a3',
  border: '1px solid #c7d2fe',
  borderRadius: 10,
  padding: '8px 12px',
  fontWeight: 600,
  fontSize: 13,
  textAlign: 'center',
  width: 150,
};
const BOOK_STYLE = {
  background: '#fff',
  color: '#1f2933',
  border: '1px solid #cbd2d9',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  textAlign: 'center',
  width: 150,
};

// --- Regroupement des lectures ---------------------------------------------
// Retourne [{ key, books }] selon le mode choisi.
function groupReads(reads, mode, selectedTheme) {
  const map = new Map();
  const push = (key, read) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(read);
  };

  for (const r of reads) {
    if (mode === 'author') {
      push(r.author, r);
    } else {
      // Sous-thème : les autres tags du livre (hors thème sélectionné).
      const others = r.themes.filter(
        (t) => t.toLowerCase() !== selectedTheme.toLowerCase()
      );
      if (others.length === 0) push('Sans sous-thème', r);
      else for (const t of others) push(t, r);
    }
  }
  return [...map.entries()].map(([key, books]) => ({ key, books }));
}

// --- Construction du graphe radial pour React Flow -------------------------
function buildGraph(theme, groups) {
  const nodes = [
    { id: 'center', position: { x: 0, y: 0 }, data: { label: theme }, style: CENTER_STYLE },
  ];
  const edges = [];

  const G = groups.length || 1;
  const R1 = 320; // distance centre -> groupe
  const R2 = 240; // distance groupe -> livre

  groups.forEach((group, gi) => {
    const angle = (2 * Math.PI * gi) / G - Math.PI / 2;
    const gx = R1 * Math.cos(angle);
    const gy = R1 * Math.sin(angle);
    const gid = `g-${gi}`;

    nodes.push({
      id: gid,
      position: { x: gx, y: gy },
      data: { label: `${group.key} (${group.books.length})` },
      style: GROUP_STYLE,
    });
    edges.push({ id: `e-c-${gi}`, source: 'center', target: gid });

    const B = group.books.length;
    const spread = Math.PI / 2.5; // ouverture de l'éventail de livres
    group.books.forEach((book, bi) => {
      const offset = B === 1 ? 0 : (bi / (B - 1) - 0.5) * spread;
      const ba = angle + offset;
      const bx = gx + R2 * Math.cos(ba);
      const by = gy + R2 * Math.sin(ba);
      const bid = `b-${gi}-${book.id}`;

      nodes.push({
        id: bid,
        position: { x: bx, y: by },
        data: { label: book.title },
        style: BOOK_STYLE,
      });
      edges.push({ id: `e-${gid}-${bid}`, source: gid, target: bid });
    });
  });

  return { nodes, edges };
}

export default function Mindmap() {
  const [reads, setReads] = useState([]);
  const [theme, setTheme] = useState('');
  const [groupBy, setGroupBy] = useState('author');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readApi
      .list()
      .then(setReads)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Thèmes disponibles (avec nombre de livres), dérivés des lectures.
  const themeOptions = useMemo(() => {
    const counts = new Map();
    for (const r of reads) for (const t of r.themes) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reads]);

  // Sélectionne le premier thème dès que la liste est disponible.
  useEffect(() => {
    if (!theme && themeOptions.length) setTheme(themeOptions[0].name);
  }, [themeOptions, theme]);

  const { nodes, edges, matched } = useMemo(() => {
    if (!theme) return { nodes: [], edges: [], matched: 0 };
    const matchedReads = reads.filter((r) =>
      r.themes.some((t) => t.toLowerCase() === theme.toLowerCase())
    );
    const groups = groupReads(matchedReads, groupBy, theme);
    return { ...buildGraph(theme, groups), matched: matchedReads.length };
  }, [theme, groupBy, reads]);

  return (
    <section>
      <div className="card mm-controls">
        <label>
          Thème
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {themeOptions.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name} ({o.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          Regrouper par
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="author">Auteur</option>
            <option value="subtheme">Sous-thème</option>
          </select>
        </label>
        {theme && (
          <span className="mm-count">
            {matched} livre{matched > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Chargement…</p>
      ) : themeOptions.length === 0 ? (
        <p>
          Aucun thème pour l'instant. Ajoutez des thèmes à vos livres lus depuis
          l'onglet « Ma bibliothèque ».
        </p>
      ) : (
        <div className="mindmap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.2}
            nodesDraggable
            defaultEdgeOptions={{ type: 'straight', style: { stroke: '#9aa5b1' } }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e4e7eb" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </section>
  );
}
