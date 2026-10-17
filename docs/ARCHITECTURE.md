# Architecture

sprout is deliberately small. Three ideas explain almost all of it.

## 1. Nodes and events

Everything you author is a **node**. Everything other people do is an **event**.

- `nodes` — posts, notes, moments, projects. Mutable, versioned by `updated_at`.
- `events` — comments, reactions, page views, mentions. **Append-only**: nothing is
  ever updated or deleted; moderation adds another row to `event_status`.

Why: assets and interactions have different lifecycles and different trust levels,
but they should share one model. A comment on a post and a comment on a moment are
the same row shape, differing only in `target_type` / `target_id`.

```sql
events(kind, target_type, target_id, actor_id, parent_id, body_md, payload, created_at)
```

The comment system therefore knows **nothing** about content types. Adding a new
content type, or a new interaction kind (`reaction`, `subscribe`, `mention`), needs
no schema change.

## 2. Type is data, not schema

`src/lib/content/registry.ts` declares the content types:

```ts
export const contentTypes = {
  post:   { route: '/posts',   i18n: true,  feed: true,  comments: true, fields: [...] },
  note:   { route: '/posts/notes', ... },
  moment: { route: '/moments', i18n: false, feed: true,  comments: true, fields: [] },
  project:{ route: '/projects', ... }
};
```

Type-specific fields are stored as JSON in `nodes.extra` and validated against the
registry. Core fields (`type`, `slug`, `lang`, `status`, `published_at`) stay real
columns so they remain queryable, indexable and exportable.

Adding `link` or `photo` is one registry entry plus content — no migration.

## 3. The database is live; the export is the archive

Publishing writes to D1 and is visible immediately — no rebuild. Portability is
guaranteed by a separate, explicit path:

```
write API ──► D1 (live) ──► deterministic export ──► plain files (archive)
                              nodes.jsonl / events.jsonl / … + Markdown + media
```

The export format is the contract (see [EXPORT-CONTRACT.md](./EXPORT-CONTRACT.md)).
D1 and the exported folder are two projections of the same data, not two sources of
truth. `content:verify` proves they still agree.

## Data flow

```
browser
  │  SSR HTML + hydration
  ▼
SvelteKit on Cloudflare Workers
  ├─ SSR: /posts/[slug], /moments, /projects, /admin …
  ├─ prerendered: /search shell
  └─ /api/*: content, events, auth, admin, export/restore
        │
        ▼
   domain layer (framework-agnostic)  src/lib/server/*
   render · repositories · auth · export · restore · search
        │
        ├─ D1 (SQLite)  ← the only runtime source of truth
        └─ R2           ← media binaries, referenced by relative key
```

## Layering and portability

Vendor coupling is confined to two places: `wrangler.toml` + `src/app.d.ts`
(bindings) and `src/lib/server/db.ts` (a ~50-line structural interface over D1/R2).
Everything above it is plain TypeScript.

That is why the tests can run the real repositories against an in-memory
`node:sqlite` database — and why moving off Cloudflare means reimplementing one
small adapter, not the application.

| Concern | Where it lives |
|---|---|
| Content types | `src/lib/content/registry.ts` |
| Node → view mapping (read time, TOC, excerpts) | `src/lib/content/view.ts` |
| Markdown → HTML | `src/lib/server/render.ts` |
| Syntax highlighting | `src/lib/highlight.js` (browser) |
| Persistence | `src/lib/server/repositories/*` |
| Portability | `src/lib/server/export.ts` + `restore.ts` |
| Auth / identity | `src/lib/server/auth.ts` |

## Decisions worth knowing

**Markdown is rendered on write, highlighted on read.** The server uses markdown-it
and stores `body_html`; code blocks are emitted as escaped text and highlighted in
the browser with highlight.js. Running a full syntax highlighter inside a Worker
either blows its resource limits (the JS regex engine on C++/CMake) or fails to
initialise (the WASM engine). Moving it to the browser made publishing cheap and
language-agnostic.

**Search is SQLite FTS5 with bigram tokenization.** CJK has no spaces; `unicode61`
treats a whole run as one token and `trigram` rejects queries shorter than three
characters. Indexing overlapping bigrams makes two-character Chinese words
searchable while keeping a single portable index.

**Comments are never mutated.** Deletion is a status row. That keeps the event log
honest, makes moderation auditable, and keeps export/restore lossless.

**Media uses relative keys.** The database stores `r2_key`, never an absolute bucket
URL. `GET /media/<key>` is our own handler, so changing storage providers changes one
file instead of rewriting every row.
