import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', 'biblio.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON'); // active la vérification des clés étrangères

// ---------------------------------------------------------------------------
// Schéma
// ---------------------------------------------------------------------------
// authors            : les auteurs (un auteur = plusieurs livres)
// books              : les livres du catalogue, rattachés à un auteur
// read_books         : une lecture d'un livre (date, note) — plusieurs
//                      lectures possibles pour un même livre (relectures)
// themes             : liste des thèmes disponibles
// read_book_themes   : liaison N-N entre une lecture et ses thèmes
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS authors (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL UNIQUE,
    birthYear INTEGER,
    createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS books (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    authorId  INTEGER NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    year      INTEGER,
    isbn      TEXT,
    createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS read_books (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    bookId    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    readDate  TEXT    NOT NULL DEFAULT (date('now')),
    rating    INTEGER CHECK (rating BETWEEN 1 AND 5),
    review    TEXT,
    createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS themes (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS read_book_themes (
    readBookId INTEGER NOT NULL REFERENCES read_books(id) ON DELETE CASCADE,
    themeId    INTEGER NOT NULL REFERENCES themes(id)     ON DELETE CASCADE,
    PRIMARY KEY (readBookId, themeId)
  );

  -- Index utiles pour les jointures et filtres fréquents
  CREATE INDEX IF NOT EXISTS idx_books_authorId       ON books(authorId);
  CREATE INDEX IF NOT EXISTS idx_read_books_bookId     ON read_books(bookId);
  CREATE INDEX IF NOT EXISTS idx_rbt_themeId           ON read_book_themes(themeId);
`);

// ---------------------------------------------------------------------------
// Données d'exemple (uniquement au tout premier lancement)
// ---------------------------------------------------------------------------
const count = db.prepare('SELECT COUNT(*) AS n FROM authors').get();
if (count.n === 0) {
  const insertAuthor = db.prepare(
    'INSERT INTO authors (name, birthYear) VALUES (?, ?)'
  );
  const insertBook = db.prepare(
    'INSERT INTO books (title, authorId, year, isbn) VALUES (?, ?, ?, ?)'
  );
  const insertRead = db.prepare(
    'INSERT INTO read_books (bookId, readDate, rating, review) VALUES (?, ?, ?, ?)'
  );
  const insertTheme = db.prepare('INSERT INTO themes (name) VALUES (?)');
  const linkTheme = db.prepare(
    'INSERT INTO read_book_themes (readBookId, themeId) VALUES (?, ?)'
  );

  db.transaction(() => {
    // Auteurs
    const dumas = insertAuthor.run('Alexandre Dumas', 1802).lastInsertRowid;
    const orwell = insertAuthor.run('George Orwell', 1903).lastInsertRowid;
    const asimov = insertAuthor.run('Isaac Asimov', 1920).lastInsertRowid;

    // Livres
    const monteCristo = insertBook.run(
      'Le Comte de Monte-Cristo', dumas, 1844, '9782253098058'
    ).lastInsertRowid;
    const nineteen = insertBook.run('1984', orwell, 1949, '9780451524935').lastInsertRowid;
    insertBook.run('Fondation', asimov, 1951, '9782070415717');

    // Thèmes
    const themeIds = {};
    for (const name of ['Aventure', 'Vengeance', 'Dystopie', 'Politique']) {
      themeIds[name] = insertTheme.run(name).lastInsertRowid;
    }

    // Lectures + thèmes associés
    const readMonte = insertRead.run(
      monteCristo, '2025-03-14', 5, 'Un chef-d\'œuvre du roman-feuilleton.'
    ).lastInsertRowid;
    linkTheme.run(readMonte, themeIds['Aventure']);
    linkTheme.run(readMonte, themeIds['Vengeance']);

    const read1984 = insertRead.run(
      nineteen, '2025-06-02', 4, 'Glaçant et toujours d\'actualité.'
    ).lastInsertRowid;
    linkTheme.run(read1984, themeIds['Dystopie']);
    linkTheme.run(read1984, themeIds['Politique']);
  })();
}

export default db;
