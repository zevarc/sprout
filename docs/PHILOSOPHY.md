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

## 2. Two primitives: nodes and events

| Primitive | What it is | Why it is separate |
|---|---|---|
| **node** | Everything *you author* (post, note, moment, project, toy, …) | Mutable, versioned by `updated_at` |
| **event** | Everything *other people do* (comment, reaction, page view, mention) | **Append-only**, auditable |

The comment system knows **nothing** about content types: it only stores
`target_type` + `target_id`. Adding a content type, or a new interaction kind
(`reaction`, `subscribe`, `mention`), needs no schema change and no change to
comments.

Moderation is also append-only: `event_status` rows are added, never updated.
Deleting a comment appends a `deleted` row; the text stays in the log for audit and
lossless export.

## 3. Type is data, not schema

- `nodes.type` is an **open vocabulary**; type-specific fields live in
  `nodes.extra` (JSON).
- Adding a type or a field is a change to `src/sprout.config.js` — **no migration**.
- **Open vocabularies vs closed enums.** Things meant to grow (`type`,
  `events.kind`, `relations.rel`, `actors.kind`) carry **no `CHECK`**; things that
  are genuinely closed (`status`, `visibility`, `sessions.role`) do. This keeps the
  database self-checking without forcing a migration for every extension.

The table set is meant to stop changing. New capabilities ride on `extra`,
`events` and `relations`; a genuinely new concept may add a **new** table
(additive), but never reshape an existing one.

## 4. One source of truth per concept

- **Grouping (translations / series) is `nodes.group_id` only.** There is no
  separate translation edge table to keep in sync; `relations` holds only ad-hoc
  edges (`related`, `reply-to`, …).
- **Rendered HTML is always derived.** `nodes.body_html` is a rebuildable cache;
  comment HTML is rendered on read and never stored. The export contains **no
  HTML**.
- **Visibility lives on the node.** Media follows its node; unattached or unknown
  media is private.
- **Authorship is an actor id**, not a copied name.

## 5. Layers and one-way dependency

```
data      SQLite schema · repositories · export/restore contract
   ↓      (consumed by)
architecture  config assembly · routing · renderers · hooks · validation
   ↓      (consumed by)
presentation  pages · components · theme tokens
```

The rule is one-way: **downstream adapts to upstream.** Architecture or UI ideas
must not force a change to the core tables. Extensions ride on `extra` / `events` /
`relations`, or add a new table.

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
| **node** | An authored record (`nodes` row) |
| **event** | An interaction (`events` row), append-only |
| **group** | `nodes.group_id`: translations/series share it |
| **extra** | JSON column holding type-specific fields |
| **renderer** | A built-in layout key (`list`/`cards`/`feed`, `article`/`compact`) |
| **feature** | A cross-cutting capability id (`comments`, `members`, …) |
| **mod** | A data contribution merged into the assembly |
| **assembly** | Base config + mods, merged into the engine registry |
| **derived** | Rebuildable output (HTML cache, FTS index, stats) |
