# Changelog

## 0.14.0 — one language switch, one site map

- **The home page no longer has its own language switcher.** It used a
  hand-rolled floating button revealed by scrolling *up*, which duplicated the
  shared control, offered only one other locale (instead of all), and could be
  tabbed into while invisible (`opacity: 0` + `pointer-events: none` keeps a
  control focusable). The home page now renders the same `LanguageSwitcher` in
  the top-right as every other page.
- **The scroll-revealed shortcut stack is gone.** Its clock icon linked to
  moments (not the timeline it looked like) and duplicated a footer entry; its
  back-to-top duplicated the article page's component. The bottom-right corner
  now holds just `BackToTop`, shared with articles.
- **The footer is the complete site map**: it gained `Search`, which previously
  had no other entry point anywhere on the site.
- Docs: chrome is described as three jobs (language top-right, footer = map,
  back-to-top bottom-right); the instance's design notes drop "floating
  search/language/back-to-top".

## 0.13.2 — mobile list titles

- The home and `/posts` lists on phones put the title into the 32px index column
  (`32px 1fr` grid, title auto-placed), so titles wrapped every two or three
  characters. Index and date now occupy row 1 and the title spans the full row.
  Restores the instance-side fix (2c2a5d16) that lived in the pre-submodule copy.

## 0.13.1 — mobile seam

- Added a bottom margin to the folded contents panel on phones: it sat directly
  on the reading sheet's top hairline, so the two rules read as a double line.

## 0.13.0 — reading sheet and interaction states

- **The article is one reading sheet.** `.post-layout` paints
  `--color-surface-raised` with a hairline border, `--radius-lg` and
  `--shadow-soft`, so title, body, related posts, comments and the table of
  contents share one surface and the blueprint grid frames a document instead of
  showing through the text column. Phones drop the card look: full-bleed sheet
  with top/bottom hairlines. Print resets the sheet to plain black on white.
- **Interaction states are tokenised and complete.** New `--color-press-tint`
  and `--color-action-bg-active`; prose links keep their dashed underline on
  hover (the tint alone is too quiet a signal on paper) and gain pressed/focus
  states, TOC rows and the expand button get pressed/inset-focus states,
  back-to-top and buttons get pressed states, tags and related rows respond,
  cards settle on press.
- **One underline mechanism.** The global `a:hover` no longer adds a
  `border-bottom`; components that want an underline declare it themselves. That
  removes the stray stub the old rule drew under pill-shaped links.
- `:visited` stays unstyled on purpose (single accent hue), documented in the
  theme docs and in the instance's design notes.

## 0.12.2 — print rules

- Print-only `display: none` now uses `!important`: a scoped component rule of the
  same name won on specificity, so the logo (and anything else styled by a
  component) still printed. The language switcher container is hidden as a whole.

## 0.12.1 — TOC folding

- Fixed the long-contents fold: 0.12.0 computed the folded rows but the
  template still rendered every heading, so the list was never shortened.

## 0.12.0 — reading polish

- **Share cards follow the theme.** `generateOgSvg` now takes its colours from
  `resolvePalette()` (base stylesheet → preset → site overrides, `var()` aliases
  followed) instead of a hard-coded copy of the classic greens. The stylesheet
  is still the only source of truth: it is inlined with `?raw` and parsed once.
  Fixed along the way: `wrapTitle` pushed a duplicate fourth line for very long
  titles, so the last line repeated itself.
- **`==highlight==`** becomes `<mark>` via a local inline rule — no
  `markdown-it-mark` dependency, because every instance mirrors the engine's
  runtime deps in its own `package.json`. Nested inline markup inside the
  highlight still parses; code spans are untouched.
- **Outbound links** get `class="external"`, `target="_blank"`,
  `rel="noopener noreferrer"` and a small `↗`; same-site and in-page links are
  unchanged.
- **Back to top** button on article pages (rAF-throttled, appears past the fold,
  reduced-motion aware, hidden in print).
- **Long contents lists fold.** Past 16 headings the TOC shows all h2s plus the
  children of the current section, with an expand button — accurate without
  becoming a wall of links. The rule lives in `lib/scroll-spy.js` (`tocRows`)
  and is unit-tested.
- **Print styles**: article only, black on white, code slabs flattened, page
  chrome (nav, TOC, comments, code buttons) hidden, outbound URLs appended to
  link text, no breaks inside tables/code/figures.
- `vitest.config.js` enables CSS processing, because the palette import is a
  `?raw` CSS module.

## 0.11.1 — TOC scroller

- Dropped the fade mask on the table-of-contents scroller: it faded the last row
  even when the list fit, which read as "there is more below" when there wasn't.

## 0.11.0 — reading experience

- **The table of contents is one component with a scroll spy.** `PostToc.svelte`
  caches heading offsets, updates once per frame, slides an indicator between
  rows, numbers h2s and dots h3/h4, distinguishes read from unread, keeps the
  active row inside its own scroll box, and marks the row with
  `aria-current="location"`. The old code re-measured every heading on every
  scroll event and kept a stale highlight when you scrolled back to the top.
- **TOC entries can no longer point at ids that do not exist.** Headings are now
  read from the same markdown-it token stream that renders the body
  (`extractHeadings` in `lib/server/render.ts`), so fenced code, inline HTML,
  entities, links, code spans, Setext headings and duplicate suffixes all match
  the rendered anchors. Runs once per request, no schema change.
- **Prose styling has one home:** `src/styles/prose.css`, applied to
  `class="prose"` (post and note bodies). Links are a colour with a dashed
  hairline instead of a hover-only change; tables get rounded corners, a tinted
  header, zebra rows, hairline columns and their own horizontal scroll box;
  `<mark>` `<kbd>` `<hr>` `<figure>` are finally styled (`<hr>` was invisible:
  the reset clears its border); quotes, lists and heading rhythm are shared
  instead of duplicated per component.
- **Code blocks belong to the palette.** The vendor `github-dark` stylesheet is
  gone; the slab is hue-tinted and the syntax colours come from `--syntax-*`
  tokens, so a snippet no longer changes the temperature of the page. The copy
  button is icon-only (no more English "Copy" flash before the client relabels
  it) and gains a language badge.
- **Colour audit fixes.** `--color-ink-faint` was 2.8:1 on paper, `--color-bud`
  was used as small text at 3.5:1, `--color-sprout-deep` at 2.9:1, and the solid
  primary button pair at 3.6:1 — all now clear 4.5:1. Text hierarchy no longer
  uses `opacity` (blogroll, login, invite, admin, comment/apply notices).
  `--color-ink-soft` is slightly darker, the yellow accent finally has a role
  (highlights, code strings, status), the scrollbar thumb is visible again, and
  `var(--radius, 12px)` no longer resolves to a fallback because `--radius-*`
  exists.
- **New tokens** (all `color-mix`-derived from the base palette, so presets and
  per-site overrides stay coherent): link, mark, quote, table, code + syntax,
  table-of-contents, pill, action/disabled, success/warning, overlay, selection,
  scrollbar, focus ring, plus `--prose-measure` and the radius/motion scales. See
  `docs/USAGE.md#5-themes`.
- **A contrast guard now runs in CI.** `tests/theme.test.js` reads the palette and
  asserts the text pairs in both colour schemes clear WCAG AA.

## 0.10.1 — instance wiring fix

- **The universal hook is loaded again in consuming apps.** The docs and the
  scaffold mapped the engine's `hooks.js` to `kit.files.hooks.client`, but
  `hooks.js` is the *universal* hook — the key is `hooks.universal`. With the
  wrong key the locale `reroute` never ran, so every `/<locale>/…` URL 404'd
  while unprefixed pages kept working. 0.10.0's engine was unaffected (it uses
  the default `src/hooks.js`); only sites that point `files.hooks` at the engine
  were broken.
- `docs/INSTANCE.md` now spells out the whole `files` mapping, including why
  `hooks.js` must be `universal`.

## 0.10.0 — engine / instance split

This release changes how a site relates to the engine. A site can now consume
this repository as a package instead of copying it: it keeps identity, content
and assets, while routes, data layer, migrations and tooling are loaded from
here. Existing standalone deployments are unaffected — the same tree still runs
as its own app.

- **The engine no longer owns identity.** `src/site.config.js` and
  `src/sprout.config.js` moved to `src/site/config.js` and `src/site/assembly.js`,
  reached through a new `$site` alias (`src/lib/site.js` → `$site/config`,
  `src/lib/sprout.js` → `$site/assembly`). Nothing else in the engine changed:
  its 469 `$lib/**` imports still point at its own code, so the same tree runs as
  a standalone app *and* as an engine package.
- **A site can consume this repo as a dependency** (`docs/INSTANCE.md`): it points
  `kit.files.{routes,lib,appTemplate,hooks}` into `packages/sprout/src/…`, keeps
  only `src/site/**`, `src/content/**`, `static/**` and `wrangler.toml`, and sets
  `migrations_dir` at the engine. No copy, no rsync, no per-file reconcile —
  installing the engine *is* the upgrade. `node scripts/init-instance.mjs` writes
  the skeleton (config, assembly, page overlay, app.d.ts, build configs).
- **Type contract for instances**: `lib/content/site.ts` exports `SiteConfig` /
  `SiteAssembly`; both the demo and any instance are checked against them.
- **Page overlays.** `/blogroll` now renders `$site/pages/blogroll.svelte` (default
  = `lib/components/blogroll/BlogrollPage.svelte`), so a site restyles the page
  without forking the route or its loader. Component-only styling also fixes a
  theme-guard violation the old inline page carried (colour literals).
- **Fonts are bundled, not copied.** `static/fonts/**` → `lib/assets/fonts/**`,
  referenced from `styles/fonts.css`; Vite emits content-hashed URLs, so an
  instance needs no `static/fonts`. The two `/fonts/*.woff2` preloads in
  `app.html` are gone with the static copies (`font-display: swap` still applies).
- **Scripts resolve the instance at runtime** (`scripts/lib/site.mjs`): `SITE_DIR`
  if set, else the working directory, then `src/site/{config,assembly}.js`. So an
  engine script run from a site's root operates on that site.
- **`tsconfig.check.json`** replaces `tsconfig.json` for the engine's own type
  gate: a vendored engine copy must not hijack Vite's tsconfig discovery in the
  consuming app.

### Friend links

- **`/friends`** is a curated blogroll: a card wall of site name, one-line
  description, avatar, RSS and group tags, ordered by `order_index`. Cards point
  outward; each link also has a `/friends/<slug>` profile page.
- **Applications are a queue, not content.** The public form (below the list)
  has a honeypot, one pending request per site URL and 3 requests per salted IP
  hash per day. A best-effort probe records whether the applicant links back;
  the result is an admin hint, never an automatic rejection.
- **Admin review.** `/admin` gains a 友链 tab: approve / reject / spam. Approval
  publishes a `friends` asset (next `order_index`) and links the request to it via
  `asset_id`.
- **Data.** `migrations/0004_friends.sql` adds `friends`, `friends_fts` and
  `friend_applications`. `friends` is a normal content kind, so it is exported and
  restorable; the application queue holds contact details and is never exported.
  The public list is intentionally language-agnostic.

## 0.9.5 — mobile pass

Audited at 320, 390, 414, 740 (landscape), 768 and 1280 px.

- **iOS Safari no longer zooms on focus.** Comment fields (14.7px), the admin
  login/filters (12.5–14.4px) and the search category select (13.6px) were under
  16px; on touch they are 1rem now. Specificity matters here: `.filters input`
  beat the plain `input` rule, so the admin override is scoped `.admin input` and
  placed last.
- **Tap targets reach the 24px floor.** Home "more"/card/footer links (18–19px),
  project titles (23px), the tags entry, timeline rows (19–23px), the About
  project link, the GitHub sign-in link and the page logo were under it; they now
  carry `min-height: 24px` without changing their look. Inline links inside a
  sentence stay as they are (WCAG 2.5.8 exempts them).
- **Safe areas.** `viewport-fit=cover` plus `env(safe-area-inset-*)` on the
  language pill, the home float group and the page body, so fixed controls clear
  notches and the home indicator.
- **Mobile type floor.** Kind badges (9.9–10.6px), tag pills (11.5px), post
  meta (11.5px), About section headings (11.5px) and tag counts now render at
  12px on phones/tablets. Media-query overrides sit at the end of each style
  block or match the base selector's specificity — both rules had silently lost
  the cascade before.
- The admin login field has a real `<label>` instead of a placeholder.

## 0.9.4 — a language switch that fits

- The switcher showed the full locale name. On the home page that name was drawn
  inside a 44px circle, so "English" was squeezed out of shape; elsewhere the pill
  grew to 84px and jostled whatever sat beside it.
- Both renderings now show a globe and a compact code (`EN`, `中`) from the new
  `short` field in `site.locales` (falling back to the uppercased code). The full
  language name stays as the accessible name (`common.switchLanguage`, e.g.
  "Switch to English"), the link carries `hreflang`, and the pill gained a
  `:focus-visible` ring plus a 44px hit area that does not change its size.
- The switcher is a flex group now: hardcoded `right: 96px` offsets meant a third
  language would have landed on top of the second.

## 0.9.3 — one person entity

- `personJsonLd()` (`content/person.ts`) builds the site owner once; the home
  page's `WebSite` gets `author` **and** `publisher`, and the About page's
  `AboutPage` reuses the same `@id` — previously each page described the author
  differently.
- Optional `logo` (512×512 PNG) and `topics` in `site.config.js`, plus
  `brand.<locale>.role`, feed the person's `image`/`logo`, `knowsAbout` and
  `jobTitle`; `logo` is also linked as the apple-touch-icon.

## 0.9.2 — SEO pass

Found by auditing a real site's head tags and sitemap.

- **Article and project pages had no `hreflang` alternates.** The loaders resolved
  translations, but the two detail routes never passed them to the renderer, so a
  bilingual site told crawlers its translations were unrelated pages. List pages,
  tag pages and the About page now emit alternates too.
- **Share cards are raster now.** `og:image` points at `site.ogImage` — a
  1200×630 PNG (`static/og-image.png` in the template) — because Facebook, X,
  LinkedIn and WeChat all reject SVG, so the per-article SVG card rendered
  nothing. Dimensions, `og:image:alt` and `og:site_name` travel with it.
- `/search` is `noindex, follow` with a canonical: result pages are reachable only
  by query string.
- **Structured data describes the kind** instead of calling everything a
  `TechArticle`: `BlogPosting` / `Article` / `SocialMediaPosting` /
  `SoftwareSourceCode`, overridable per type with `schemaType`. Nodes carry
  `inLanguage`, `keywords`, `image` and `mainEntityOfPage`; detail pages add a
  `BreadcrumbList`; the About page carries the detailed `Person`.
- **The sitemap no longer contradicts the pages.** `/search` and `/timeline` are
  `noindex`, so they are no longer listed; content is grouped by translation, one
  entry per group with `hreflang` alternates and each locale's real slug, instead
  of one unpaired entry per locale. Tag entries are grouped the same way.

## 0.9.1 — comments on static pages

Hand-written pages can take comments without becoming content.

- New engine kind `page` (`migrations/0002_pages.sql`) and `commentablePages` in
  `sprout.config.js`: declare `/about` and the About page renders the same comment
  section as posts and notes.
- The anchor asset is created on the first comment, with a deterministic id
  (`page:about:zh`), so export/restore carry it like any other kind.
- Pages never appear in lists, feeds, the sitemap, tags, search or the admin
  editor: the anchor exists only so comments have an `assets.id` to reference.
- Also fixed in this release: the tag filter referenced an alias from outside the
  UNION wrapper, which broke every `/tags/<tag>` page.

## 0.9.0 — BREAKING (data model v4)

The single `nodes` table becomes a shared `assets` row plus one table per content
kind; identity merges into `people`. Database schema `4`, export format `4`.
Existing data moves through the export contract, not through `migrations apply`:

```bash
pnpm content:export ./v3
pnpm content:migrate-v3-to-v4 ./v3 ./v4
# fresh schema, then:
pnpm content:restore ./v4
```

**Data model**
- `assets` holds only what code must filter or sort by without knowing the kind:
  `type`, `lang`, `group_id`, `status`, `visibility`, `published_at`,
  `occurred_at`, `author_id` (never null), timestamps.
- One table per kind (`posts`, `notes`, `moments`, `projects`, …): the asset id is
  the primary key; title, body, slug and the kind's own attributes are real
  columns with real constraints. `node_fields` and its key/value rows are gone.
- `people` replaces `actors`: `role` (`owner` / `member` / null) is the only
  authority, a partial unique index allows one owner, and sessions carry no role.
  `email_enc` is gone. Revoking a member retires the person instead of deleting
  them, so attribution survives.
- `comments` replace the generic `events` table for comments; moderation is one
  status column (no log, no "newest row wins"). `reactions` is its own table with
  an `(asset, person, emoji)` primary key.
- `tags` + `asset_tags` replace per-node tag strings, so renaming a tag is one
  UPDATE and per-kind counts are one `GROUP BY`.
- `media` is one row per stored object (`r2_key` unique) plus `asset_media`
  bindings: `alt`, `position` and `role` (`body` / `cover`) belong to the use.
  Deleting is "unbind, then collect"; an object in use cannot be dropped. Reads
  are public only when **every** binding is public.
- Each kind has its own FTS5 index; search is per kind.
- `scheduled` is gone (nothing could schedule it); `featured` is gone (curation,
  if wanted, gets its own table); `body_html` is still a derived, unexported cache.
- Home sections order by publish time, or by a declared field when `sort` is set
  (projects use `order_index`). The writing section is therefore "latest", not
  "selected".

**Export contract v4**
- One file per table, and `schema.json` carries `types`; a bundle from a newer
  build no longer crashes an older one (unknown kind files are skipped with a
  warning). Restore orders writes by foreign key and recomputes the HTML and the
  search indexes.
- Not exported: `sessions`, `invites`, `page_views`, `meta`, the FTS tables.

**Search and the site**
- Search is per content kind (each kind has its own index), so the search page now
  has a category selector and the API takes `type`.
- Project cards and the project page read `stage` / `repoUrl` (the columns are
  `stage` and `repo_url`).

**Admin**
- No "featured" toggle; the cover is set from the media list (`role = 'cover'`),
  and field inputs edit the kind's real columns.

**Fixes found by migrating a real site (zevarc.com) to this model**
- Filtering a list by tag works again: the tag predicate used the inner table's
  alias from outside the UNION wrapper, so every `/tags/<tag>` page failed with
  `no such column: assets.id` (schema 4 only).
- An untitled asset no longer stores its slug as the title: kinds whose `title` is
  optional store `NULL`, and `nodeToView` shows the summary (then the slug) — feed
  items, headings and structured data are never empty.
- `/media/<key>` serves `image/svg+xml` instead of forcing a download, so SVG
  logos and covers render in `<img>`. Still sandboxed (`sandbox`, `default-src
  'none'`) and sniff-proof.
- `content:restore` sends the target origin with its multipart upload: SvelteKit's
  CSRF check used to reject every media upload on a deployed site (local dev hid
  it), and the script reported success with R2 empty. It now fails loudly.
- Engine tests take their expectations from the instance's own dictionaries and
  locale list, so they pass in any site, not just the template.

## 0.8.0 — BREAKING

Type-specific data becomes first-class: the `nodes.extra` JSON blob is gone.

**Multilingual correctness**
- Detail pages resolve `hreflang` alternates and the language switcher from the
  node's `group_id` (`translationLinks`), so a translation may use a **different
  slug** and unpublished/private translations are never linked.
- RSS channel copy (`feed.label`, `feed.language`) moved out of `lib/feed.ts` into
  the dictionaries — adding a language no longer means editing the engine.
- `sitemap.xml` uses `site.defaultLocale` (not `locales[0]`) for `<loc>` and
  `x-default`, and boot validation rejects duplicate locale codes.
- Dates are locale-driven: `formatDate` / `formatMonth` keep the terse `YYYY.MM.DD`
  and `YYYY.MM` by default and switch to `Intl` when a locale declares
  `intl`/`dateFormat` — the per-component date helpers (and the timeline's month
  label) are gone.
- `<html>` carries `dir` from `site.locales` (a locale opts in with `dir: 'rtl'`),
  set at SSR and kept in sync on the client.

**Data model (`schema_version = 3`, export format `3`)**
- New `node_fields` table: one **typed** row per `(node_id, field)`
  (`value_text` / `value_number` / `value_bool` / `value_json`, exactly one
  non-null). Filtering and sorting by a field is ordinary indexed SQL.
- New `node_tags` table: tags are a many-to-many relation, so archives, counts and
  "related by tag" are plain `GROUP BY` / `JOIN` queries.
- `nodes.featured` is a column (cross-type home selection), not a JSON flag.
- `nodes.cover_media_id` references a `media` row — a real FK, not a URL string.
- `extra.images` is gone: a gallery is the node's `media`, ordered by `position`.
- `nodes.extra` is removed. `nodes.summary` is the single source for descriptions
  (the old `extra.description` fallback is gone).

**Declarative fields actually land**
- `sprout.config.js` `fields` now drives the admin editor (one input per field),
  the write boundary, and the tests.
- `POST/PATCH /api/nodes` validate and normalize `fields`: unknown keys, wrong
  types and out-of-options `select` values are **400**. Numbers arriving as strings
  are coerced.
- `restore` and `import` deliberately skip validation (the export contract must
  stay lossless); `import` passes non-core frontmatter keys through as `fields`.

**Export / restore**
- Export v3: `node_fields.jsonl` + `node_tags.jsonl`; `nodes.jsonl` no longer has
  `extra`. The Markdown mirror renders `fields` and `tags` in frontmatter.
- Restore refuses v2 bundles; use `pnpm content:migrate-v2-to-v3 <v2> <v3>` to
  convert (tags → rows, cover/images → media references, description → summary).
- Restore order is FK-safe: nodes → fields → tags → media → covers.

**Bug fixes**
- `scripts/import.mjs` no longer reads the removed `scripts/seed-projects.json`.
- `listTags` moved to `repositories/tags.ts` (its JSON-column query was replaced
  by the relation).

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
