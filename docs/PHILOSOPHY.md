# Design philosophy

sprout is a **portable, extensible personal content platform**. This page explains
*why* it is built the way it is. For the concrete layout see
[ARCHITECTURE](./ARCHITECTURE.md); for module-level detail see
[IMPLEMENTATION](./IMPLEMENTATION.md).

---

## 1. The premise: the data is the product

Most personal-site tools lock your writing into their platform. sprout takes the
opposite position:

> **The database is the single source of truth; the export is its public API.**

Consequences that show up everywhere in the code:

- Content lives in standard SQLite (Cloudflare D1). Media is referenced by a
  **relative key** (`<sha256>.<ext>`), never an absolute bucket URL.
- There is an explicit `export → verify → restore` path that proves the data can
  leave at any time, including media binaries.
- The export is **deterministic** (sorted rows, stable JSON key order, ISO-8601
  timestamps). Two consecutive exports of an unchanged database are byte-identical,
  so the folder works as a git mirror with clean diffs.
- No vendor id is ever a primary key. Moving off Cloudflare means replacing one
  small adapter (`src/lib/server/db.ts`), not the application.

## 2. What you author, what others do, and who is involved

| Primitive | What it is | Why it is separate |
|---|---|---|
| **asset** | Everything *you author* (post, moment, project, …) | `assets` holds the shared part; one table per kind holds the content |
| **interaction** | Everything *other people do* (comment, reaction) | Points at an asset id, never at a kind table |
| **person** | Everyone involved, on both sides | Content authorship and comment authorship are the same table |

A comment knows **nothing** about content kinds: it stores an asset id. Adding a
content kind therefore touches no comment, tag or media row.

Moderation is a status **column** on a comment (`pending` / `approved` / `spam` /
`deleted`), not a separate log, so no read has to work out "the newest row".

## 3. Kind is data, content is columns

- `assets.type` is an **open vocabulary**: it says which kind table holds the
  detail. Shared concepts (`visibility`, `status`, `occurred_at`, `lang`, `author`)
  are columns on `assets`; everything a reader experiences as "this content" is a
  real column on the kind's own table, with its own `NOT NULL` / `CHECK`.
- Adding a content kind is a **new table** and touches nothing else; adding a
  shared capability is one column on `assets`.
- **Open vocabularies vs closed enums.** Things meant to grow (`type`, `media.kind`,
  `identities.provider`) carry **no `CHECK`**; things that are genuinely closed
  (`status`, `visibility`, `role`, `comments.status`) do. The database stays
  self-checking without a migration for every extension.

The table set grows by **addition**: a new kind, a new interaction — new tables.
A shipped table's shape is not edited to make a feature fit.

## 4. One source of truth per concept

- **Grouping (translations / series) is `assets.group_id` only.** There is no
  separate translation edge table to keep in sync.
- **Rendered HTML is always derived.** `body_html` on a kind table is a rebuildable
  cache; comment HTML is rendered on read and never stored. The export contains
  **no HTML**.
- **Visibility lives on the asset.** Media readability follows the assets that use
  it; an object nothing references is private.
- **Authority lives in one column** (`people.role`); sessions do not copy it.
- **Authorship is a person id**, never a copied name.

## 5. Layers and one-way dependency

```
data      SQLite schema · repositories · export/restore contract
   ↓      (consumed by)
architecture  config assembly · routing · renderers · hooks · validation
   ↓      (consumed by)
presentation  pages · components · theme tokens
```

The rule is one-way: **downstream adapts to upstream.** Architecture or UI ideas
must not force a change to the core tables. A new capability rides on a column of
`assets` or of a kind's own table, or on a new table.

## 6. Architecture choices

1. **Configuration is assembly.** `site.config.js` answers *who you are*;
   `sprout.config.js` answers *what you are made of* (types, features, home,
   theme, mods). A pure merge builds one registry.
2. **One route tree for N languages.** A non-default locale is a URL prefix; a
   universal `reroute` hook strips it **for matching only**, leaving
   `url.pathname` intact. Adding a language needs no route files.
3. **Types choose built-in renderers.** `list` / `cards` / `feed` and `article` /
   `compact` are keys, not components. Bespoke visuals are static-route overrides.
   There is no fragile dynamic component registration.
4. **Capabilities are gated once.** Cross-cutting features (`comments`, `members`,
   `analytics`, `timeline`) are declared in a list and checked with
   `hasFeature(id)`; content types are not feature flags.

## 7. Presentation is a token layer

- Components contain **no colour literals** (a test enforces it). They read CSS
  custom properties only.
- A theme is a set of tokens: `classic`, `mono`, `warm` presets, plus arbitrary
  overrides in config. `?theme=<preset>` previews one request.
- Restyling never forks a component.

## 8. Verifiability over discipline

Key invariants are tests or boot-time checks, not conventions:

- export → restore → export is **byte-identical**;
- routes may not issue SQL (scanned test);
- components may not contain colour literals (scanned test);
- config is validated at boot (routes, locales, features, renderer keys, mod ids);
- private content is invisible by default (queries default to `public`; private
  detail and media return 404).

## 9. Deliberate non-goals

- No plugin that injects route files. SvelteKit routes cannot be imported; routes
  are data + static overrides.
- No dynamic component registry, no framework switch.
- Analytics is an operational artifact, not content; it is not exported.
- No site-specific home/nav shape in the engine — that is configuration.

## 10. Glossary

| Term | Meaning |
|---|---|
| **asset** | An authored record; the shared row that comments, tags and media point at |
| **kind** | A content kind (`post`, `moment`, `project`, …) — one table each |
| **interaction** | A comment or a reaction on an asset |
| **person** | A human: owner, member, or commenter (`people` row) |
| **group** | `assets.group_id`: translations/series share it |
| **tag** | A vocabulary row (`tags`) plus usage rows (`asset_tags`) |
| **renderer** | A built-in layout key (`list`/`cards`/`feed`, `article`/`compact`) |
| **feature** | A cross-cutting capability id (`comments`, `members`, …) |
| **mod** | A data contribution merged into the assembly |
| **assembly** | Base config + mods, merged into the engine registry |
| **derived** | Rebuildable output (HTML cache, FTS index, stats) |
