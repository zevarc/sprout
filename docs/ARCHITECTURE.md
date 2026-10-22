# Architecture

sprout is built on three statements: **the data is the single source of truth;
the architecture only consumes it; the presentation only consumes the
architecture.** The reasoning is in [PHILOSOPHY](./PHILOSOPHY.md); module-level
detail is in [IMPLEMENTATION](./IMPLEMENTATION.md).

---

## 1. Layers

```
┌ presentation  components · theme tokens · ?theme= preview
│
├ architecture  config assembly · routing · renderers · hooks · validation
│
└ data          SQLite schema · repositories · export/restore contract
```

| Layer | Location | Responsibility |
|---|---|---|
| Data | `migrations/`, `src/lib/server/**`, `src/lib/content/view.ts` | Authoritative reads/writes, visibility, export contract, derived caches |
| Architecture | `src/lib/engine/**`, `src/hooks*.js`, `src/routes/**` | Assembly, routing, renderers, auth gates, validation |
| Presentation | `src/lib/components/**`, `src/styles/**`, `src/lib/engine/theme.ts` | UI that reads views + tokens |

One-way dependency is a hard rule: architecture/UI must not reshape core tables.
A new capability rides on a column of `assets` or of a kind's own table, or on a
new table; a new content kind is a new table.

---

## 2. Data model

Full column/constraint detail: [DATA-MODEL](./DATA-MODEL.md). Export format:
[EXPORT-CONTRACT](./EXPORT-CONTRACT.md).

| Table | Purpose | Key facts |
|---|---|---|
| `assets` | The shared part of content | Opaque ULID `id`; `type` says which kind table holds the detail; `lang`; `group_id` groups translations/series; `status`; `visibility`; `published_at` / `occurred_at`; `author_id` never null |
| `posts`, `moments`, `projects`, … | One table per content kind | The asset id is the primary key; the kind's own columns carry real `NOT NULL` / `CHECK`; `UNIQUE (lang, slug)` locally |
| `comments` | Comments on any asset | Points at `assets.id`, never at a kind table; one `status` column; author never null |
| `reactions` | Reactions | `(asset, person, emoji)` is the primary key |
| `tags`, `asset_tags` | Tags | A vocabulary table plus usage, so renaming a tag is one `UPDATE` |
| `media`, `asset_media` | R2 metadata | One row per stored object (`r2_key` unique); `alt` / `position` / `role` are per use; deleting is "unbind, then collect" |
| `people`, `identities` | Identity | `role` (`owner` / `member` / null) is the only authority; provider ids map to *your* person id |
| `sessions`, `invites` | Login | Only HMACs of tokens are stored; sessions carry no role |
| `page_views` | Analytics | Aggregated on write; not exported |
| `<kind>_fts` | Search | One FTS5 index per kind; derived |

---

## 3. Configuration as assembly

Two files with different jobs:

| File | Contents |
|---|---|
| `src/site.config.js` | `name`, `url`, `author`, `contact`, `locales`, `defaultLocale`, `brand` |
| `src/sprout.config.js` | `contentTypes`, `features`, `home`, `theme`, `mods`, `privateRoutes`, `content` |

`src/lib/engine/assembly.ts` is pure: it merges the base config with every `mod`
into one assembly. `src/lib/engine/registry.ts` is the single object the engine
reads. A mod may contribute `contentTypes`, `features`, `home.sections`,
`theme.tokens`, and `i18n` fragments.

**Content types are site-owned.** The engine defines their shape
(`lib/content/schema.ts`) and helpers (`lib/content/registry.ts`); the list of
types belongs to the site. This resolves the historical "who owns the registry?"
ambiguity between the two example deployments.

**Boot validation** (`lib/engine/validate.ts`) runs from `hooks.server.js` and
fails loudly on: malformed/duplicate type routes, locale/type-route collisions,
unknown feature ids, unknown `listRenderer`/`detailRenderer` keys, duplicate mod
ids.

---

## 4. Routing and locales

### Route map

`[[lang]]` is not a route param — the tree is rooted, and a universal hook strips
non-default locale prefixes **for matching**. The effective routes:

| Path | Purpose | Auth |
|---|---|---|
| `/` | Home (`home.sections`) | public |
| `/[type]` | Generic list (single-segment types) | public if `type.public` |
| `/[type]/[slug]` | Generic detail | public if `type.public`; private nodes 404 |
| `/posts`, `/posts/[slug]` | Bespoke post list/detail (static override) | public |
| `/notes/[slug]` | Note detail (generic detail) | public |
| `/projects`, `/projects/[slug]` | Bespoke project list/detail | public |
| `/tags`, `/tags/[tag]` | Tag archive | public |
| `/about`, `/search` | Static pages | public |
| `/timeline` | Merged timeline | public (public entries; add `/timeline` to `privateRoutes` for members-only) |
| `/admin` | Console (client app) | token session |
| `/login`, `/invite/[token]` | Sign in / accept invite | public |
| `/feed.xml`, `/og/[slug].svg` | Per-locale outputs | public |
| `/sitemap.xml` | Site-wide, all locales | public |
| `/media/[...key]` | R2 objects | node visibility |
| `/api/**` | JSON endpoints | per endpoint |

Non-default locales are prefixes (`/zh/posts/x`, `/zh/feed.xml`, `/zh/og/x.svg`).
`api/**`, `media/**` and `sitemap.xml` stay at the root.

### The locale mechanism

```js
// src/hooks.js — a universal hook (NOT hooks.server.js)
export function reroute({ url }) {
  const segs = url.pathname.split('/').filter(Boolean);
  if (!NON_DEFAULT_LOCALES.includes(segs[0])) return;
  const rest = segs.slice(1).join('/');
  return rest ? `/${rest}` : '/';
}
```

Verified properties:

- route **matching** uses the rewritten path;
- `url.pathname` keeps the **original**, prefixed path;
- loaders therefore call `localeFromPath(event.url.pathname)`;
- `getLink(path, lang)` / `homePath(lang)` build prefixed URLs;
- adding a language needs **no route files**;
- detail pages resolve alternates from the node's group (`translationLinks`), so a
  translation may use a **different slug**; the language switcher then offers only
  the languages that actually have the piece;
- `<html>` gets the locale's `lang` **and** `dir` at SSR (both from `site.locales`
  metadata), and dates come from that same metadata rather than per-component code.

The optional-param design (`[[lang]]` in the tree) was measured and rejected:
it greedily consumes a segment, so `/posts/hello` resolves as
`lang=posts,type=hello`, and `/zh` is captured by `[type]`.

### Static overrides

SvelteKit ranks a static segment above a dynamic one. A type that needs bespoke
markup keeps its own `/<route>/…` routes; the generic `[type]` routes simply do
not win for those paths.

---

## 5. Renderers (type → presentation)

| Field | Values | Default |
|---|---|---|
| `listRenderer` | `list`, `cards`, `feed` | `list` |
| `detailRenderer` | `article`, `compact` | `article` |

- `ContentListPage` is one page shell with three entry layouts.
- `ContentDetail` is the compact detail (title/meta/body/comments, no TOC or
  related list); `Post` is the article detail (TOC, read time, related, comments).
- `type.comments` decides whether the detail shows comments; list/detail
  always display `occurredAt ?? date` and receive the active `lang`.
- Bespoke visuals are static routes, not dynamically registered components.

---

## 6. Theme (presentation)

- Components contain **no colour literals** (scanned by a test); they read CSS
  custom properties.
- `lib/engine/theme.ts` resolves `theme.name` + `theme.tokens` (config + mod
  contributions) into `:root` declarations, with a dark-mode block when the preset
  provides one.
- The CSS is injected into `<head>` at SSR (no flash). `?theme=<preset>` previews a
  preset for one request without touching config.
- Presets: `classic` (base palette), `mono`, `warm`. Any token can be overridden.
- `--shadow-*` tokens make elevation themeable too.

---

## 7. Data accuracy is structural

1. **Routes never issue SQL.** `tests/architecture.test.js` scans `src/routes/**`
   and fails on `db.prepare` / `query` / `run` / `first`. Reads and writes go
   through `lib/server/**` and `lib/content/view`.
2. **Visibility authority is in the domain layer.** `listViews` defaults to
   `visibility='public'`; `/api/search` restricts anonymous callers to public;
   private detail pages 404; `/media` uses `mediaAccess` (node wins, unattached =
   private).
3. **Derived caches have one rebuild path**: `lib/server/rebuild.ts`
   (`/api/admin/rerender`). The export never contains HTML; comment HTML is
   rendered on read.
4. **Single source of truth**: grouping, translations, authorship and visibility
   are defined only in the data layer.
5. **Invalidation is centralized**: writes call `invalidateNode` /
   `invalidateAll`; affected paths are derived from the registry (types +
   locales), never hand-written arrays.

---

## 8. Data flow

**Read**

```
browser → hooks.server (lang, private guard, security headers, theme CSS)
        → hooks.js reroute (strip locale for matching only)
        → route load → content/view + repositories (visibility, derived fields)
        → Svelte SSR / JSON
```

**Write**

```
API → isEditor / isAdmin → repository
    (render body_html, index FTS, persist group_id)
    → invalidateNode / invalidateAll (feed, sitemap, og, lists)
```

**Portability**

```
D1 (live) ──export──▶ JSONL + Markdown + media (deterministic)
         ◀──restore── empty DB (UPSERT, re-render HTML, re-upload media)
```

---

## 9. Vendor coupling

Only three places know about Cloudflare:

- `wrangler.toml` / `wrangler.demo.toml` (bindings),
- `src/app.d.ts` (`App.Platform` shape),
- `src/lib/server/db.ts` (a minimal structural interface over D1/R2).

Everything else is plain TypeScript. Tests run the real repositories against an
in-memory `node:sqlite`.

> `restore` uses UPSERT, not `INSERT OR REPLACE`: the latter deletes the row and
> re-inserts it, which cascades child rows away when foreign keys are enforced.

---

## 10. Directory map

```
src/
  site.config.js        identity
  sprout.config.js      assembly (types, features, home, theme, mods)
  content/              seed content
  lib/
    engine/             assembly · registry · features · validate · theme
    content/            schema · types · registry(helpers) · view
    server/             db · render · search · auth · cache · export · restore
                        rebuild · stats · mediaAccess · loadNode · id · repositories/
    components/         generic UI (views + tokens only)
    i18n/               locale model + dictionaries
  routes/               pages, [type] generic routes, API, media, sitemap
  hooks.js              reroute (universal)
  hooks.server.js       lang, private guard, security headers, theme injection
migrations/0001_init.sql
tests/                  unit tests + architecture guards
```

---

## 11. Decisions worth knowing

- **Markdown rendered on write, highlighted in the browser.** A full highlighter
  inside a Worker blows CPU/memory limits; write-time rendering only runs
  markdown-it.
- **Search is FTS5 + bigram.** CJK has no spaces; bigrams make two-character words
  searchable; Latin words are lowercased. One index per content kind.
- **Comments carry one status column.** `pending` / `approved` / `spam` / `deleted`
  is a column, not a log, so no read has to resolve "the newest row".
- **Media uses relative keys.** Changing storage providers changes one handler.
- **Only single-segment type routes get a generic list page.** Multi-segment
  routes (e.g. `/lab/notes`) are served by their own static routes and are not
  advertised as list pages in the sitemap.
- **The table set grows by addition.** A new content kind is a new table (plus its
  search index and an exporter line); a new shared capability is one column on
  `assets`. A shipped table's shape is never edited to make a feature fit.
