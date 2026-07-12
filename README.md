# Biblio 📚

Application web fullstack de gestion d'une bibliothèque personnelle : ajoutez des livres, marquez-les comme lus et supprimez-les.

- **Frontend** : React + Vite
- **Backend** : Node.js + Express
- **Base de données** : SQLite (via `better-sqlite3`)

## Structure du projet

```
biblio/
├── client/          # Application React (Vite)
│   ├── src/
│   │   ├── App.jsx  # Composant principal
│   │   ├── api.js   # Client HTTP vers l'API
│   │   └── ...
│   └── package.json
├── server/          # API Express + SQLite
│   ├── src/
│   │   ├── index.js # Routes de l'API
│   │   └── db.js    # Connexion et schéma SQLite
│   └── package.json
└── README.md
```

## Prérequis

- [Node.js](https://nodejs.org/) **18 ou supérieur** (nécessaire pour `--watch` et `better-sqlite3`)
- npm (fourni avec Node.js)

## Lancer le projet en local

Le projet se compose de deux parties à démarrer séparément (deux terminaux).

### 1. Backend (API)

```bash
cd server
npm install
npm run dev      # ou : npm start
```

L'API démarre sur **http://localhost:3001**.
Au premier lancement, un fichier `biblio.db` est créé automatiquement avec quelques livres d'exemple.

### 2. Frontend (interface)

Dans un **second terminal** :

```bash
cd client
npm install
npm run dev
```

L'interface est accessible sur **http://localhost:5173**.

> Le serveur de développement Vite redirige automatiquement les appels `/api` vers le backend sur le port 3001 (voir `client/vite.config.js`), il n'y a donc aucune configuration supplémentaire à faire.

## API

Base : `http://localhost:3001`

| Méthode | Route             | Description                  |
| ------- | ----------------- | ---------------------------- |
| GET     | `/api/health`     | État du serveur              |
| GET     | `/api/books`      | Liste des livres             |
| GET     | `/api/books/:id`  | Détail d'un livre            |
| POST    | `/api/books`      | Ajouter un livre             |
| PUT     | `/api/books/:id`  | Modifier un livre            |
| DELETE  | `/api/books/:id`  | Supprimer un livre           |
| GET     | `/api/authors/search?q=` | Rechercher un auteur via Open Library |
| GET     | `/api/authors/:id/works` | Bibliographie d'un auteur (Open Library) |
| POST    | `/api/books/read`     | Marquer une œuvre comme lue (crée auteur + livre au besoin) |
| GET     | `/api/read-books`     | Liste des livres lus (avec note et thèmes) |
| PATCH   | `/api/read-books/:id` | Modifier la note (`rating`) et/ou les thèmes (`themes`) |
| DELETE  | `/api/read-books/:id` | Retirer un livre des lectures |

> Les routes `/api/authors/*` interrogent l'API publique [Open Library](https://openlibrary.org/developers/api). Le `:id` est l'identifiant OLID renvoyé par la recherche (ex : `OL26320A`). Elles nécessitent un accès réseau sortant.

Exemple de corps pour la création (`POST /api/books`) :

```json
{
  "title": "L'Étranger",
  "author": "Albert Camus",
  "year": 1942,
  "read": false
}
```

## Build de production (frontend)

```bash
cd client
npm run build      # génère le dossier dist/
npm run preview    # sert le build localement pour vérification
```
