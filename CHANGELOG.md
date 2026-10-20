# Changelog

## 0.7.0

UI theming and generic rendering — the data/architecture semantics reach the page.

**Generality**
- A type chooses built-in renderers: `listRenderer` (`list` | `cards` | `feed`) and
  `detailRenderer` (`article` | `compact`). Bespoke looks stay **static-route overrides**.
- `type.comments` now actually drives whether a detail page shows comments (it was
  declared but ignored).
- `ContentListPage` is one page shell with `list` / `cards` / `feed` layouts;
  `ContentDetail` is the compact detail (no TOC/related).
- `moments` migrated onto the generic path (`/moments`, `/moments/<slug>`); its bespoke
  routes and `MomentFeed` are gone, so the generic path is proven by a real page.
- Renderers display `occurredAt ?? date` and receive the active `lang`.

**Theming**
- New `warm` preset (light + dark).
- `?theme=<preset>` previews any preset for a request without changing config.
- `listRenderer` / `detailRenderer` keys are validated at boot.

**Correctness & consistency (docs ↔ code audit)**
- Every public listing defaults to `visibility = 'public'`: the tag archive and
  sitemap no longer count tags that only exist on private nodes, and the static
  `projects/[slug]` override 404s a private project like the generic detail route.
- The article detail (`Post`) honours `occurredAt ?? date` and `type.comments`, so
  static and generic detail routes behave identically.
- `PATCH /api/nodes/[id]` validates `status`/`visibility` (400s) and reports a slug
  conflict as 409 instead of surfacing a raw SQL constraint error; `POST
  /api/admin/import` validates the type and enum values the same way.
- Mods can contribute `i18n` fragments; `getDictionary` deep-merges them over the
  built-in dictionaries (per locale).
- `restore` writes relations with `ON CONFLICT DO NOTHING` — no `INSERT OR REPLACE`
  anywhere, matching the documented contract.

## 0.6.0

The architecture layer: config as assembly, one route tree for every language.

**Config split into identity + assembly**
- `src/site.config.js` is now only *who you are* (name, url, author, contact, locales, brand).
- `src/sprout.config.js` is *what you're made of*: `contentTypes`, `features`, `home`,
  `theme`, `mods`, `privateRoutes`, `content`.
- **Types are capabilities**: declaring a type gives it routes; there are no
  `features.moments`/`features.projects` booleans any more.
- Cross-cutting capabilities (`comments`/`members`/`analytics`/`timeline`) are a
  declared list gated by `hasFeature(id)` — `site.features.*` is gone.
- Config is validated at boot (`lib/engine/validate.ts`): bad routes, duplicate routes,
  locale/route collisions and unknown feature ids fail loudly, not as runtime 404s.

**One route tree, N languages**
- The duplicated `/zh/**` tree is deleted. A single root tree (`[type]`,
  `[type]/[slug]`, fixed pages, feed, og) serves every locale.
- `src/hooks.js` exports a universal `reroute()` that strips a non-default locale
  prefix **for matching only**; `event.url` keeps the real path so loaders resolve the
  locale with `localeFromPath`. Verified by a spike: the `[[lang]]` optional-param
  alternative mis-resolved `/posts/hello` and `/zh`.
- Private-route guards strip the locale prefix first, so `/zh/timeline` is guarded too.

**Contributions & configurable home**
- `lib/engine/assembly.ts` is a pure merge of base config + `mods` (each contributes
  `contentTypes`, `features`, `home.sections`, `theme.tokens`, `i18n`); `lib/engine/registry.ts`
  is the single assembled source the engine reads. `contentTypes` are now **site-owned**.
- The home page is driven by `home.sections` (per-section `types`, `layout: list|cards`,
  `limit`, and which `extra` fields the cards surface). The engine no longer contains a
  site's home shape; `homeSelection` and its project coupling are gone.
- Boot validation also rejects missing/duplicate mod ids.

**Data accuracy is now structural**
- Routes never touch SQL: media/stats/rebuild/grouping moved into
  `lib/server/{repositories/media,stats,rebuild,mediaAccess}.ts` and repository
  functions. A test (`tests/architecture.test.js`) fails if any route calls
  `db.prepare`/`query`/`run`/`first`.
- Derived-cache invalidation has one entry point (`invalidateNode`/`invalidateAll`
  in `lib/server/cache.ts`); import, restore, grouping and media mutations now purge
  the derived output instead of leaving stale feed/sitemap/og.

**Theme layer (presentation)**
- `lib/engine/theme.ts` resolves `theme.name` + `theme.tokens` (config, plus mod
  contributions) into `:root` declarations with a dark-mode block, injected at SSR.
  Presets: `classic` (base palette) and `mono`; any token can be overridden.
- Components now contain **no colour literals** — the last hardcoded shadow colours
  became `--shadow-*` tokens. A test (`tests/architecture.test.js`) fails if a
  component `<style>` introduces a hex/rgba literal, so a style change stays a token
  change.

## 0.5.0

The data model, settled — so the tables can stop changing.

**One canonical schema.** `0001_init.sql` is now a single, complete schema (the
`0002`/`0003` ALTER chain is folded in). From here only additive migrations are
allowed. `meta.schema_version` records the revision; the export carries it.

**Identity is opaque.** Every node/event/actor/media id is a generated ULID, never
derived from content — renaming a slug or fixing a language no longer breaks a
reference. Import is keyed on `(type, slug, lang)` instead of a synthetic id.

**One source of truth per concept.** Translations/series live only in `nodes.group_id`
(opaque, defaults to the node's own id); the `relations` edge table now holds only
ad-hoc links (`related`/`reply-to`/…), so there is no O(n²) translation clutter and
nothing to keep in sync. `media.visibility` is gone — readability is the node's.

**Rendered HTML is always derived.** `nodes.body_html` stays a cache; comment HTML is
rendered on read and never stored. No HTML appears in the export.

**Constraints match intent.** Closed enums (`status`, `visibility`, `sessions.role`)
carry `CHECK`; open vocabularies (`type`, `events.kind`, `relations.rel`, `actors.kind`)
do not — so new kinds never need a migration. Foreign keys are declared; the in-memory
test database enforces them.

**Export format v2.** Restore reads it and refuses anything newer; writes use UPSERT so
foreign keys can never cascade away children mid-restore.

## 0.4.0

Six generic capabilities pulled up from real, running instances — each behind a
`site.config.js` switch and off by default, so an existing site is unaffected.

**Private content & membership**
- per-node `visibility` (`public` / `private`); public listings and search default
  to public, private detail pages 404 for everyone but owner/member, and
  `/media/<key>` inherits the owning node's visibility
- single-use invite links (`/invite/<token>`, `features.members`): an owner mints a
  link, the opener becomes a `member` and can record content — `isEditor` guards
  content writes, `isAdmin` (owner only) guards members, export and moderation
- migration `0002_visibility_and_time.sql`, `0003_invites.sql` (additive)

**Event time & timeline**
- `occurred_at` — when a thing happened, distinct from when it was published; the
  list query can order by either
- merged `/timeline` across every type (`features.timeline`, `site.content.timelineOrder`)

**Type-as-route & locales**
- registry entries gain `label`, `public`, `select` fields; a single-segment type
  route gets generic `/[type]` and `/[type]/[slug]` pages, overridable by a static
  route (`src/routes/[type]`)
- the engine is now locale-generic: `site.locales` drives links, feeds, sitemap,
  `og`, `hreflang` and the HTML `lang`; a single-language site needs no `/<code>` tree

## 0.3.0

Tags, and a proper authoring pass on the admin editor.

**Tags**
- `/tags` and `/tags/[tag]` (plus the `/zh/…` pair): every tag gets an archive
  page; tags are matched exactly against `extra.tags` through `json_each`
- post tags are links; archive pages emit `CollectionPage` and are in the sitemap
- the archive is reachable from the footer and from the posts page (not only
  through a tag on an article)

**Admin editor**
- unsaved-changes guard and local autosave (restore or discard), ⌘/Ctrl+S to save,
  ⌘/Ctrl+Enter to preview
- list search plus type/language/status filters, and bulk publish/archive
- Markdown toolbar; uploaded images are inserted at the cursor as
  `![alt](/media/…)`, with the alt stored on the media row
- split preview that refreshes as you type
- pre-publish checks (missing alt, heading level skips, empty summary, duplicate
  slug) — warnings you can override, not blockers
- editable publish date, and a confirmation when a published slug changes
- media panel: edit alt, reorder, delete (the R2 object goes with it)
- translation pairing: link a node to its counterpart in the other language
- `extra` is now written per content type instead of always

**API**
- `PATCH /api/nodes/[id]` accepts `lang` and `publishedAt` (both were silently dropped)
- new `/api/admin/link` (GET/POST/DELETE) and GET/PATCH/DELETE on `/api/admin/media`

## 0.2.0

Hardening, discovery and performance pass — plus the fixes that came out of
running the platform on a real site.

**Security**
- `/media` no longer passes R2's stored `Content-Type` straight through: only
  image/video extensions are served with their real type, everything else is
  forced to `application/octet-stream` + `Content-Disposition: attachment`, and
  every response carries `nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`
  (an uploaded/restored `.html` or `.svg` can no longer execute on your origin)
- site-wide security headers: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`; `/admin` also sends `X-Robots-Tag: noindex`

**Discovery**
- homepage emits `WebSite` + `Person` structured data (with `SearchAction`)
- search pages accept `?q=` — searches are linkable, and the `SearchAction` works
- headings on list pages no longer skip a level (h1 → h2)

**Performance**
- fonts are self-hosted: Latin/Latin-ext variable woff2 (six files, ~300 KB)
  replaces the render-blocking Google Fonts stylesheet and its preconnects
- Markdown images get `loading="lazy" decoding="async"`
- new `POST /api/admin/rerender` rebuilds the derived `body_html` column from
  `body_md` (needed after a renderer change; touches nothing else)

**Fixes**
- comment avatars were being hit by the article-body `img` rule (40 px margins
  turned a 28 px avatar row into 108 px); body-only rules are now scoped
- GitHub login is reachable from the comment form, returns you to the page you
  came from, and signing out clears the linked identity
- in-page anchors are no longer hidden under the fixed header
- icon-only external links have accessible names and a 24×24 target
- `prefers-reduced-motion` now actually disables the animations (the token
  override it relied on was consumed by nothing)
- removed ~55 unused design tokens and de-duplicated the page-header, card and
  pill styles into shared classes

## 0.1.0

First public release — the platform extracted from a personal site.

**Content**
- one typed content model (`post`, `note`, `moment`, `project`) driven by a registry
- write-time Markdown rendering; heading ids match the TOC extractor
- browser-side syntax highlighting (highlight.js), so publishing never hits Worker
  CPU/memory limits and every language works

**Interactions**
- append-only event log; comments are type-agnostic (`target_type` + `target_id`)
- anonymous-first identity with signed cookies, optional GitHub OAuth
- moderation queue, rate limiting, honeypot, XSS-safe comment rendering

**Discovery**
- SQLite FTS5 search with bigram tokenization (CJK-friendly)
- dynamic RSS, sitemap and OG images derived from the database
- cookie-free, self-hosted page-view analytics

**Operator experience**
- `/admin`: editor, live preview, media upload, moderation, stats
- `pnpm bootstrap`: one-command Cloudflare setup (D1 + R2 + secrets + migrations)
- Vue-free, framework-thin layering: vendor coupling limited to one adapter

**Portability**
- deterministic `export → restore → verify` loop, including media binaries
- standard SQLite schema; relative media keys; no vendor ids as primary keys
- unit tests run against an in-memory `node:sqlite` database
