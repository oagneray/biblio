import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Vérification de l'état du serveur
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Intégration Open Library (https://openlibrary.org/developers/api)
// ---------------------------------------------------------------------------
const OPEN_LIBRARY = 'https://openlibrary.org';

// Petit utilitaire de requête avec timeout pour ne pas bloquer indéfiniment.
async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Biblio/1.0 (exemple pédagogique)' },
    });
    if (!res.ok) throw new Error(`Open Library a répondu ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Recherche d'auteurs : GET /api/authors/search?q=tolkien
app.get('/api/authors/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Le paramètre "q" est obligatoire' });
  try {
    const data = await fetchJson(
      `${OPEN_LIBRARY}/search/authors.json?q=${encodeURIComponent(q)}`
    );
    const authors = (data.docs || []).map((d) => ({
      id: d.key, // OLID, ex : "OL26320A"
      name: d.name,
      birthDate: d.birth_date ?? null,
      topWork: d.top_work ?? null,
      workCount: d.work_count ?? 0,
    }));
    res.json(authors);
  } catch (e) {
    const status = e.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ error: `Recherche impossible : ${e.message}` });
  }
});

// Bibliographie d'un auteur : GET /api/authors/OL26320A/works?limit=50
app.get('/api/authors/:id/works', async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  try {
    const data = await fetchJson(
      `${OPEN_LIBRARY}/authors/${encodeURIComponent(id)}/works.json?limit=${limit}`
    );
    const works = (data.entries || []).map((w) => ({
      id: w.key, // ex : "/works/OL45804W"
      title: w.title,
      coverId: Array.isArray(w.covers) ? w.covers[0] : null,
      firstPublished: w.first_publish_date ?? null,
    }));
    res.json({ authorId: id, total: data.size ?? works.length, works });
  } catch (e) {
    const status = e.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ error: `Bibliographie indisponible : ${e.message}` });
  }
});

// Sélectionne un livre avec le nom de son auteur et un indicateur "lu"
// (dérivé de l'existence d'une entrée dans read_books).
const SELECT_BOOK = `
  SELECT b.id, b.title, b.year, b.isbn, b.authorId, b.createdAt,
         a.name AS author,
         EXISTS (SELECT 1 FROM read_books r WHERE r.bookId = b.id) AS read
  FROM books b
  JOIN authors a ON a.id = b.authorId
`;

// Trouve un auteur par son nom (insensible à la casse) ou le crée.
// Complète l'année de naissance si elle était inconnue.
function findOrCreateAuthor(name, birthYear) {
  const existing = db
    .prepare('SELECT * FROM authors WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) {
    if (birthYear && !existing.birthYear) {
      db.prepare('UPDATE authors SET birthYear = ? WHERE id = ?').run(birthYear, existing.id);
    }
    return existing.id;
  }
  return db
    .prepare('INSERT INTO authors (name, birthYear) VALUES (?, ?)')
    .run(name, birthYear ?? null).lastInsertRowid;
}

// Liste de tous les livres
app.get('/api/books', (req, res) => {
  const books = db.prepare(`${SELECT_BOOK} ORDER BY b.createdAt DESC`).all();
  res.json(books);
});

// Récupération d'un livre par son id
app.get('/api/books/:id', (req, res) => {
  const book = db.prepare(`${SELECT_BOOK} WHERE b.id = ?`).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Livre introuvable' });
  res.json(book);
});

// Création d'un livre (ajout manuel ou import depuis Open Library).
// L'auteur est retrouvé ou créé automatiquement à partir de son nom.
app.post('/api/books', (req, res) => {
  const { title, author, birthYear, year, isbn } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'Le titre et l\'auteur sont obligatoires' });
  }
  try {
    const book = db.transaction(() => {
      const authorId = findOrCreateAuthor(author.trim(), birthYear ?? null);
      const info = db
        .prepare('INSERT INTO books (title, authorId, year, isbn) VALUES (?, ?, ?, ?)')
        .run(title.trim(), authorId, year ?? null, isbn ?? null);
      return db.prepare(`${SELECT_BOOK} WHERE b.id = ?`).get(info.lastInsertRowid);
    })();
    res.status(201).json(book);
  } catch (e) {
    res.status(500).json({ error: `Ajout impossible : ${e.message}` });
  }
});

// Mise à jour d'un livre.
// Le champ "read" bascule l'existence d'une entrée dans read_books :
// true  -> enregistre une lecture datée d'aujourd'hui (si aucune n'existe)
// false -> supprime les lectures associées.
app.put('/api/books/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Livre introuvable' });

  const { title, year, isbn, read } = req.body;
  db.transaction(() => {
    db.prepare('UPDATE books SET title = ?, year = ?, isbn = ? WHERE id = ?').run(
      title ?? existing.title,
      year ?? existing.year,
      isbn ?? existing.isbn,
      existing.id
    );

    if (read !== undefined) {
      const already = db
        .prepare('SELECT 1 FROM read_books WHERE bookId = ?')
        .get(existing.id);
      if (read && !already) {
        db.prepare('INSERT INTO read_books (bookId) VALUES (?)').run(existing.id);
      } else if (!read) {
        db.prepare('DELETE FROM read_books WHERE bookId = ?').run(existing.id);
      }
    }
  })();

  const book = db.prepare(`${SELECT_BOOK} WHERE b.id = ?`).get(existing.id);
  res.json(book);
});

// Suppression d'un livre (les lectures liées sont supprimées en cascade)
app.delete('/api/books/:id', (req, res) => {
  const info = db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Livre introuvable' });
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Lectures (read_books) et thèmes
// ---------------------------------------------------------------------------
const SELECT_READ = `
  SELECT r.id, r.bookId, r.readDate, r.rating, r.review,
         b.title, b.year, a.name AS author
  FROM read_books r
  JOIN books b   ON b.id = r.bookId
  JOIN authors a ON a.id = b.authorId
`;

// Attache la liste des thèmes (tableau de noms) à une ligne de lecture.
function withThemes(row) {
  const themes = db
    .prepare(
      `SELECT t.name FROM read_book_themes rbt
       JOIN themes t ON t.id = rbt.themeId
       WHERE rbt.readBookId = ? ORDER BY t.name`
    )
    .all(row.id)
    .map((t) => t.name);
  return { ...row, themes };
}

// Marque une œuvre comme lue depuis la bibliographie :
// crée l'auteur et le livre au besoin, puis l'entrée read_books datée du jour.
app.post('/api/books/read', (req, res) => {
  const { title, author, birthYear, year } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'Le titre et l\'auteur sont obligatoires' });
  }
  try {
    const result = db.transaction(() => {
      const authorId = findOrCreateAuthor(author.trim(), birthYear ?? null);
      let book = db
        .prepare('SELECT * FROM books WHERE title = ? COLLATE NOCASE AND authorId = ?')
        .get(title.trim(), authorId);
      if (!book) {
        const info = db
          .prepare('INSERT INTO books (title, authorId, year) VALUES (?, ?, ?)')
          .run(title.trim(), authorId, year ?? null);
        book = db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
      }
      let read = db.prepare('SELECT * FROM read_books WHERE bookId = ?').get(book.id);
      if (!read) {
        // readDate prend la date du jour par défaut (voir schéma)
        const info = db.prepare('INSERT INTO read_books (bookId) VALUES (?)').run(book.id);
        read = db.prepare('SELECT * FROM read_books WHERE id = ?').get(info.lastInsertRowid);
      }
      return { bookId: book.id, readId: read.id };
    })();
    res.status(201).json(result);
  } catch (e) {
    res.status(500).json({ error: `Marquage impossible : ${e.message}` });
  }
});

// Liste des livres lus (avec note et thèmes)
app.get('/api/read-books', (req, res) => {
  const rows = db.prepare(`${SELECT_READ} ORDER BY r.readDate DESC, r.id DESC`).all();
  res.json(rows.map(withThemes));
});

// Mise à jour d'une lecture : note (rating), commentaire (review) et/ou thèmes.
// Le tableau "themes" (noms) remplace intégralement les thèmes existants ;
// chaque thème est retrouvé ou créé automatiquement.
app.patch('/api/read-books/:id', (req, res) => {
  const read = db.prepare('SELECT * FROM read_books WHERE id = ?').get(req.params.id);
  if (!read) return res.status(404).json({ error: 'Lecture introuvable' });

  const { rating, review, themes } = req.body;
  if ('rating' in req.body && rating !== null && !(rating >= 1 && rating <= 5)) {
    return res.status(400).json({ error: 'La note doit être comprise entre 1 et 5' });
  }

  try {
    db.transaction(() => {
      if ('rating' in req.body || 'review' in req.body) {
        db.prepare('UPDATE read_books SET rating = ?, review = ? WHERE id = ?').run(
          'rating' in req.body ? rating : read.rating,
          'review' in req.body ? review : read.review,
          read.id
        );
      }
      if (Array.isArray(themes)) {
        db.prepare('DELETE FROM read_book_themes WHERE readBookId = ?').run(read.id);
        const findTheme = db.prepare('SELECT id FROM themes WHERE name = ? COLLATE NOCASE');
        const addTheme = db.prepare('INSERT INTO themes (name) VALUES (?)');
        const link = db.prepare(
          'INSERT OR IGNORE INTO read_book_themes (readBookId, themeId) VALUES (?, ?)'
        );
        for (const raw of themes) {
          const name = String(raw).trim();
          if (!name) continue;
          const found = findTheme.get(name);
          const themeId = found ? found.id : addTheme.run(name).lastInsertRowid;
          link.run(read.id, themeId);
        }
      }
    })();
    const updated = db.prepare(`${SELECT_READ} WHERE r.id = ?`).get(read.id);
    res.json(withThemes(updated));
  } catch (e) {
    res.status(500).json({ error: `Mise à jour impossible : ${e.message}` });
  }
});

// Retire un livre de la liste des lectures (le livre reste au catalogue)
app.delete('/api/read-books/:id', (req, res) => {
  const info = db.prepare('DELETE FROM read_books WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Lecture introuvable' });
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`API Biblio démarrée sur http://localhost:${PORT}`);
});
