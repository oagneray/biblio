// Petit client HTTP pour parler à l'API Biblio.
// Les URLs commencent par /api et sont redirigées vers le backend via le proxy Vite.

const BASE = '/api/books';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  list: () => fetch(BASE).then(handle),
  create: (book) =>
    fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(book),
    }).then(handle),
  update: (id, patch) =>
    fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(handle),
  remove: (id) => fetch(`${BASE}/${id}`, { method: 'DELETE' }).then(handle),
};

// Recherche d'auteurs et bibliographies via Open Library (proxifié par le backend).
export const authorsApi = {
  search: (q) => fetch(`/api/authors/search?q=${encodeURIComponent(q)}`).then(handle),
  works: (id) => fetch(`/api/authors/${encodeURIComponent(id)}/works`).then(handle),
};

// Livres lus (read_books) : marquage, liste, note et thèmes.
export const readApi = {
  list: () => fetch('/api/read-books').then(handle),
  // Marque une œuvre comme lue (crée auteur + livre au besoin) -> { bookId, readId }
  markWork: (payload) =>
    fetch('/api/books/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(handle),
  // Met à jour note (rating) et/ou thèmes (tableau de noms)
  update: (id, patch) =>
    fetch(`/api/read-books/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(handle),
  remove: (id) => fetch(`/api/read-books/${id}`, { method: 'DELETE' }).then(handle),
};
