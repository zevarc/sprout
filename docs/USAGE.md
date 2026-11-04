# Usage

How to configure sprout, write content, and operate the admin console.
Deployment: [DEPLOY](./DEPLOY.md). Data lifecycle:
[DATA-IMPORT-EXPORT](./DATA-IMPORT-EXPORT.md).

---

## 1. Prerequisites

- Node 20+, pnpm 9+
- For local development only: a `.dev.vars` file (see [DEPLOY](./DEPLOY.md#8-local-development))

---

## 2. Configuration

Both files below live in the **instance** (`src/site/`), reached through the
`$site` alias. See [INSTANCE](./INSTANCE.md) if this site consumes the engine as
a package — the paths are the same, only `$site` changes where it points.

### 2.1 `src/site/config.js` — identity

| Key | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Used in titles, nav, footer, JSON-LD |
| `url` | string | yes | No trailing slash. Drives canonical, hreflang, sitemap, OG, RSS |
| `author` | string | yes | Structured-data author |
| `contact.email` | string | yes | About page / footer |
| `contact.github` | string | yes | About page / footer / `sameAs` |
| `ogImage` | string | no | Share card; defaults to `/og-image.png` (must be PNG/JPEG — platforms ignore SVG) |
| `logo` | string | no | 512×512 PNG: the `Person` image/logo in structured data, and the apple-touch-icon |
| `topics` | string[] | no | `knowsAbout` in structured data |
| `brand.<locale>.role` | string | no | `jobTitle` in structured data (per locale) |
| `locales` | `{ code, label, intl?, dateFormat?, dir? }[]` | yes | Order is display order; `defaultLocale` (default: the first entry) owns the unprefixed URLs |
| `defaultLocale` | string | no | Must be one of `locales` |
| `brand` | `Record<locale, Brand>` | yes | Homepage/share copy |

`Brand` fields: `claim`, `claimSource`, `creed[]`, `ogTagline`, `seoTitle`,
`seoDescription`, `feedDescription`. All are strings except `creed`, which is a
string array.

```js
export const site = {
  name: 'my-site',
  url: 'https://example.com',
  author: 'Your Name',
  contact: { email: 'hello@example.com', github: 'https://github.com/you' },
  locales: [{ code: 'en', label: 'English' }, { code: 'zh', label: '中文' }],
  defaultLocale: 'en',
  brand: {
    en: { claim: '…', claimSource: '', creed: ['Write', 'Keep', 'Export'],
          ogTagline: '…', seoTitle: '…', seoDescription: '…', feedDescription: '…' },
    zh: { … }
  }
};
```

### 2.2 `src/site/assembly.js` — assembly

| Export | Type | Notes |
|---|---|---|
| `contentTypes` | `Record<string, ContentTypeDef>` | The site's types |
| `features` | `string[]` | Known ids: `comments`, `members`, `analytics`, `timeline` |
| `home` | `{ sections: HomeSection[] }` | Home page composition |
| `theme` | `{ name, tokens }` | `classic` / `mono` / `warm`, plus token overrides |
| `privateRoutes` | `string[]` | Non-type paths that require a session |
| `content` | `{ defaultVisibility, timelineOrder }` | Defaults for new nodes |
| `mods` | `Mod[]` | Data contributions merged into the assembly |

Site wording belongs in `mods[].i18n`, not in the engine's `lib/i18n/*.js`: the
engine deep-merges mod fragments over its dictionaries (arrays replace
wholesale), so renaming a nav entry or replacing the About copy never forks an
engine file:

```js
export const mods = [
	{ id: 'site-copy', i18n: { en: { nav: { about: 'Me' } }, zh: { nav: { about: '关于我' } } } }
];
```

`ContentTypeDef`:

| Key | Type | Default | Notes |
|---|---|---|---|
| `type` | string | — | Stored in `nodes.type` |
| `route` | string | — | e.g. `/posts`. A single segment gets generic pages |
| `label` | `Record<locale,string>` | — | Shown in nav/headers |
| `public` | boolean | `false` | `false` = owner/member only |
| `feed` | boolean | `false` | Include in RSS |
| `comments` | boolean | `false` | Show comments on the detail page |
| `listRenderer` | `list` \| `cards` \| `feed` | `list` | Generic list layout |
| `detailRenderer` | `article` \| `compact` | `article` | Generic detail layout |
| `fields` | `FieldDef[]` | `[]` | Declarative field metadata |

`FieldDef`: `key`, `label`, `type` (`text` | `textarea` | `markdown` | `tags` |
`url` | `number` | `date` | `boolean` | `select`), optional `required`, optional
`options: { value, label }[]` for `select`.

`HomeSection`: `types: string[]`, `layout: 'list' | 'cards'`, `title` (dotted i18n
key), `more` (dotted i18n key), `morePath` (path without locale), `limit: number`,
optional `fields: string[]` (which declared fields cards display), optional
`sort: { field, numeric?, direction? }` (order by a declared field — e.g. a curated
`order` — with NULLs last; omitted means newest first).

`Mod`: `id` (required), optional `contentTypes`, `features`, `home.sections`,
`theme.tokens`, `i18n`.

---

## 3. Content types

### 3.1 Adding a type

```js
// src/site/assembly.js
export const contentTypes = {
  …existing,
  link: {
    type: 'link',
    route: '/links',              // single segment → generic /links + /links/<slug>
    label: { en: 'Links', zh: '链接' },
    public: true,
    feed: false,
    comments: false,
    listRenderer: 'cards',
    detailRenderer: 'compact',
    fields: [
      { key: 'url', label: { en: 'URL', zh: '链接' }, type: 'url', required: true },
      { key: 'note', label: { en: 'Note', zh: '备注' }, type: 'textarea' },
      { key: 'tags', label: { en: 'Tags', zh: '标签' }, type: 'tags' }
    ]
  }
};
```

No migration and no route files. A **multi-segment** route (for example
`/lab/notes`) cannot use the generic pages; give it static routes instead.

### 3.2 Declarative fields

`fields` describes what a type carries. **Each declared field is a real column on
that kind's table**, and the **same declaration drives three things**:

1. the admin editor renders one input per field (text, textarea, markdown, url,
   number, date, boolean, select);
2. the write boundary (`POST`/`PATCH /api/nodes`) validates and normalizes the
   values — an unknown key, a bad type or a value outside a `select`'s options is
   a **400**;
3. the database holds it: the column exists, so `NOT NULL` and indexes apply.

Adding a field is a migration (one `ALTER TABLE` on that kind), not a config-only
change — that is the price of real columns. Cross-type concepts (`tags`,
`visibility`, `occurred_at`, authorship) are columns or join tables instead — see
[DATA-MODEL](./DATA-MODEL.md). `restore` trusts the bundle; `import` runs the same
validation as the API.

### 3.3 Renderers

| Key | Layout | Used for |
|---|---|---|
| `list` | date + title + excerpt rows | articles, notes |
| `cards` | card grid (title/excerpt/date/tags) | projects, friends |
| `feed` | timeline (date, HTML, images) | moments, micro-posts |
| `article` | TOC, read time, related, comments | long-form posts |
| `compact` | title/meta/body/comments, no TOC | short posts |

A bespoke look is a **static route override** (`src/routes/<route>/…`), which
SvelteKit ranks above the generic `[type]` routes.

---

## 4. Home page

```js
export const home = {
  sections: [
    { types: ['post', 'note'], layout: 'list',
      title: 'home.selectedWriting', more: 'home.allWriting',
      morePath: 'posts', limit: 5 },
    { types: ['project'], layout: 'cards',
      title: 'home.selectedProjects', more: 'home.allProjects',
      morePath: 'projects', limit: 4,
      fields: ['year', 'status', 'website', 'github'],
      // optional: curated order instead of newest-first
      sort: { field: 'order', numeric: true, direction: 'asc' } }
  ]
};
```

- Each section selects declared types and orders by publish time — or by a
  declared field when `sort` is set (projects use `order_index`).
- `title` / `more` are dotted keys in `src/lib/i18n/*.js`.
- `fields` applies to `cards` and reads the item's declared attribute.
- Sections with no declared types render nothing.

---

## 5. Themes

Presets: `classic` (base palette), `mono`, `warm`.

```js
export const theme = {
  name: 'warm',
  tokens: { '--color-bud': '#9a6b3f' }
};
```

- Overrides win in both light and dark mode.
- Preview any preset for one request: `/posts?theme=mono`.
- `?theme=classic` means "use the base palette".
- Most other tokens are **derived** with `color-mix` from the ones below, so
  overriding `--color-bud` / `--color-paper` / `--color-ink` also re-tints links,
  tables, quotes, highlights, code and the table of contents. You rarely need to
  set more than the paper/ink/accent group.

### Token reference (main groups)

| Group | Tokens |
|---|---|
| Paper/ink | `--color-paper`, `--color-paper-deep`, `--color-paper-line`, `--color-ink`, `--color-ink-soft`, `--color-ink-faint` |
| Accent | `--color-bud`, `--color-bud-deep`, `--color-bud-soft`, `--color-bud-pale`, `--color-sprout`, `--color-sprout-deep`, `--color-sprout-pale`, `--color-sprout-ink` |
| Surfaces | `--color-surface`, `--color-on-surface`, `--color-surface-container`, `-low`, `-high`, `--color-surface-raised` (the reading sheet), `--color-primary`, `--color-on-primary`, `--color-primary-container`, `--color-on-primary-container`, `--color-error`, `--color-outline`, `--color-divider` |
| Text & links | `--color-text-meta`, `--color-text-faint`, `--color-link`, `--color-link-line`, `--color-link-hover` |
| Controls | `--color-action-bg`, `--color-action-ink`, `--color-action-bg-hover`, `--color-action-bg-active`, `--color-press-tint`, `--color-pill-bg`, `--color-pill-ink`, `--color-disabled-bg`, `--color-disabled-ink`, `--focus-ring` |
| Prose | `--color-mark-bg`, `--color-mark-ink`, `--color-quote-bg`, `--color-quote-line`, `--color-table-head`, `--color-table-row-alt`, `--color-table-line`, `--color-code-bg`, `--color-code-fg`, `--color-code-border`, `--color-code-chrome`, `--color-code-chrome-ink`, `--color-code-faint`, `--syntax-*` |
| Table of contents | `--color-toc-pill`, `--color-toc-badge`, `--color-toc-badge-ink`, `--color-toc-active`, `--color-toc-read`, `--color-toc-unread`, `--color-toc-track` |
| Status | `--color-success`, `--color-warning`, `--color-error` |
| Chrome | `--color-overlay`, `--color-scroll-track`, `--color-scroll-thumb`, `--color-scroll-thumb-hover`, `--color-selection-bg`, `--color-selection-ink` |
| Background art | `--grid-line`, `--grad-bud-a`, `--grad-bud-b`, `--grad-bud-c` |
| Typography | `--font-serif`, `--font-sans`, `--font-mono` |
| Layout | `--content-max-width`, `--content-padding`, `--prose-measure` |
| Rhythm | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-pill`, `--ease-out`, `--dur-fast`, `--dur-med` |
| Elevation | `--shadow-soft`, `--shadow-float`, `--shadow-glow`, `--shadow-card` |

Two rules that keep the palette coherent (both are covered by tests):

- The Open Graph share image (`/og/<slug>.svg`) is drawn from the same palette:
  it resolves the theme (base sheet → preset → site overrides) instead of
  hard-coding the stock greens.
- **Text never uses plain `--color-bud`.** It is a decorative green (3.5:1 on paper):
  links, dates and labels use `--color-bud-deep`, or `--color-text-meta` /
  `--color-text-faint` for hierarchy. Don't fake hierarchy with `opacity`.
- **Solid buttons use `--color-action-bg` + `--color-action-ink`**, not
  `--color-primary` + `--color-on-primary` (that pair does not clear AA at small
  sizes). `tests/theme.test.js` asserts the pairs in both colour schemes.
- **Interaction states are part of the theme, not the component.** Hover tints
  with the `-hover` tokens, pressing with `--color-press-tint` /
  `--color-action-bg-active`, keyboard focus with `--focus-ring` (inset rings on
  rows, `outline-offset: 1px` on inline links). `:visited` is deliberately not
  styled: one accent hue cannot express it without breaking the palette.

Long-form typography — links, lists, quotes, `<hr>`, tables, `<mark>`, `<kbd>`,
figures and the rendered heading body — lives in `src/styles/prose.css` and
applies to any element with `class="prose"`. Components own layout only.

---

## 6. Languages

Add a language:

1. Add `{ code: 'ja', label: '日本語' }` to `site.locales`.
2. Add `src/lib/i18n/ja.js` with the same keys as `en.js` — including
   `feed: { label, language }` (the RSS channel-title suffix and the `<language>` tag).
3. Register it in `src/lib/i18n/index.js` (`baseDictionaries`).
4. Add a `brand.ja` entry in `src/site/config.js` (optional but recommended).

URL scheme: the default locale lives at the root (`/posts/x`); every other locale
is a prefix (`/ja/posts/x`). No route files are needed. Always build links with
`getLink(path, lang)` / `homePath(lang)`, and resolve the active locale with
`localeFromPath(pathname)`.

Translated content is grouped by `group_id`, **not** by a shared slug: a piece may
use a different slug per language. Detail pages derive their `hreflang` alternates
from the group, and the language switcher offers exactly the languages that have a
translation.

Dates and direction come from the same locale metadata. By default a date renders as
the terse, unambiguous `YYYY.MM.DD`; declare `intl` (a BCP-47 tag such as `'ja-JP'`)
and `dateFormat` (Intl options, e.g. `{ year: 'numeric', month: 'long', day: 'numeric' }`)
to use that locale's own convention instead (timeline month headings follow the same
rule — `YYYY.MM`, or that locale's format with the day dropped):

```js
locales: [
  { code: 'en', label: 'English', intl: 'en-US' },
  { code: 'ja', label: '日本語', intl: 'ja-JP', dateFormat: { year: 'numeric', month: 'long', day: 'numeric' } },
  { code: 'ar', label: 'العربية', dir: 'rtl' }
]
```

Declaring `dir: 'rtl'` makes the server emit `<html dir="rtl">` and the client keep
it in sync on navigation. Components still use physical CSS properties, so a full
RTL layout needs its own stylesheet — the attribute and hooks are the foundation,
not the finished layout.

i18n key groups: `nav`, `home`, `posts`, `search`, `comments`, `moments`,
`projects`, `friends`, `tags`, `about`, `seo`, `feed.label`, `feed.language`,
`common.empty`, `language`.

---

## 7. Private content and members

- `assets.visibility`: `public` | `private`; the default comes from
  `content.defaultVisibility`.
- `contentTypes[type].public = false`: every route for that type requires an
  owner/member session.
- `privateRoutes`: non-type paths (e.g. `/timeline`) guarded the same way.
- `features: ['members']` enables invite links:
  - owner: `/admin` → Members → generate a single-use link (default 14 days);
  - the invitee opens `/invite/<token>` and becomes a `member` (no account);
  - members can read/write content; they cannot manage members, moderate, or
    export.
- Private media follows its node; anonymous requests get 404.

| Role | Content | Moderation | Members | Export |
|---|---|---|---|---|
| owner | ✅ | ✅ | ✅ | ✅ |
| member | ✅ | — | — | — |
| visitor/anonymous | comments | — | — | — |

---

## 8. Timeline and event time

- `features: ['timeline']` enables `/timeline`. It is public by default and shows
  public entries to visitors (private entries appear only with an owner/member
  session); list `/timeline` in `privateRoutes` if the whole timeline should be
  members-only.
- Every node can carry `occurredAt` (when it happened) alongside `publishedAt`
  (when it was published). `content.timelineOrder` selects the ordering.
- Lists and the timeline display `occurredAt ?? date`.

---

## 9. Admin console

Open `/admin` and sign in with `ADMIN_TOKEN`.

| Tab | What it does |
|---|---|
| Content | search, type/language/status filters, select + bulk publish/archive, create/edit/delete |
| Moderation | approve / spam / delete pending comments (append-only) |
| Stats | last N days: totals, per day, top paths, referrers |
| Members | mint/revoke invites, remove members (only when `members` is on) |

Editor features: Markdown toolbar, unsaved-changes guard, local autosave,
⌘/Ctrl+S save, ⌘/Ctrl+Enter preview, split preview, editable publish date,
**occurred time** and **visibility**. The slug is optional — leave it empty and
it is generated from the title, or from the date for untitled entries; the editor
remembers the last language you wrote in. Pre-publish warnings (empty summary, missing alt,
heading level skips, duplicate slug), slug-change confirmation, media panel (alt/reorder/delete), translation pairing (same
`group_id`).

---

## 10. Comments

- Anonymous-first: a display name and a signed cookie are enough.
- Optional GitHub sign-in (see [GITHUB-LOGIN](./GITHUB-LOGIN.md)); the button is
  hidden when unconfigured.
- New comments are pending by default; the owner and previously approved
  commenters are auto-approved.
- Limits: 8 comments per actor per 10 minutes; 4000 characters; honeypot field;
  raw HTML is escaped.
- Deletion is a status row; the comment text stays in the log.

### Comments on static pages

A hand-written page (`/about`) can take comments without becoming content: declare
it in `commentablePages` and the engine renders the same comment section the note
and post pages use.

```js
export const commentablePages = [{ path: '/about', title: { en: 'About', zh: '关于' } }];
```

The page's copy stays in the dictionaries (or in a `mods[].i18n` fragment for
site-specific wording). The database gains one anchor asset per
locale, created when the first comment arrives — id `page:about:zh`, kind `page`.
Pages are invisible to lists, feeds, the sitemap, tags and search; they exist so a
comment has an `assets.id` to reference like everything else conversational. They
travel in the export like any other kind (`pages.jsonl`).

---

## 11. Search

- `/search` and `/search?q=…` (linkable).
- Server-side FTS5 with bigram tokenization; two-character Chinese words match.
- Anonymous search only returns public nodes.

```bash
curl -s --get --data-urlencode "q=构建" --data "lang=zh" \
  https://your-domain/api/search
```

## 12. Analytics

- Cookie-free, self-hosted; aggregated to `page_views` (day, path, referrer,
  views), pruned after 400 days.
- Disable by removing `analytics` from `features` (the beacon stops and the
  endpoint returns `{ok:true}` without writing).
- Not part of the content export.

---

## 13. Authoring

- Online: `/admin` → Content → New. Markdown with preview.
- Markdown support: headings (TOC anchors), fenced code (copy button,
  language badge, browser-highlighted), tables (rounded, zebra, own scroll box),
  images (lazy), lists, blockquotes, `==highlight==` → `<mark>`, `<kbd>`,
  `<hr>`, figures.
- Outbound `http(s)` links open in a new tab, get `rel="noopener noreferrer"`
  and a small `↗` marker; links to the site itself and in-page anchors are left
  alone.
- Long tables of contents (more than 16 headings) fold to "all h2 + the current
  section" with an expand button, so the list stays scannable without hiding
  where the reader is.
- Printing hides the page chrome (nav, TOC, comments, code buttons, back-to-top),
  switches the article to black on white and prints outbound URLs after the link
  text.
- Uploads: images become `/media/<sha256>.<ext>` in the body and in the media
  panel.
- Bulk/Markdown import: [DATA-IMPORT-EXPORT](./DATA-IMPORT-EXPORT.md#import).

## 14. Commands

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm dev:clean` | dev server / clean caches and restart |
| `pnpm check` / `pnpm test` / `pnpm build` | type-check / unit tests / build |
| `pnpm bootstrap` | create D1/R2, secrets, `.dev.vars`, migrate |
| `pnpm run deploy` / `pnpm run deploy:demo` | deploy the main / demo Worker |
| `pnpm db:migrate:local` / `:remote` | apply migrations |
| `pnpm db:console:local "SQL"` | run SQL against the local DB |
| `pnpm content:import` / `export` / `restore` / `verify` | content lifecycle |
| `pnpm check:links` / `check:sitemap` | crawl links / validate sitemap |
| `pnpm notify:indexnow` | submit sitemap URLs to IndexNow |

> `pnpm deploy` is a pnpm built-in; use `pnpm run deploy` for the script.

---

## 15. Recipes

### Add a mod

```js
// src/mods/family.js (or a package)
export default {
  id: 'family',
  contentTypes: { toy: { type: 'toy', route: '/toys', label: { zh: '玩具' }, public: true, fields: [] } },
  features: ['members'],
  home: { sections: [{ types: ['toy'], layout: 'cards', title: 'home.toys', more: 'home.toys', morePath: 'toys', limit: 4 }] },
  theme: { tokens: { '--color-bud': '#4a4a45' } }
};

// src/site/assembly.js
import family from './mods/family.js';
export const mods = [family];
```

### Override a type's markup

Create `src/routes/links/+page.svelte` and `+page.server.ts`; the static route wins
over `[type]`. Keep reads/writes in the domain layer (the architecture guard
enforces this).

### Add a language

See §6. No route files are needed.

---

## 16. Friend links

`/friends` is a static override of the `friend` kind declared in
`src/site/assembly.js`: cards point outward, and the application form sits below
the list. `migrations/0004_friends.sql` creates the two tables — run
`pnpm db:migrate:local` (or `:remote`) once after pulling.

### Adding a link

1. `/admin` → Content → **+ 新建** → type `friend`.
2. `title` is the site name, `summary` the one-line description.
3. Declared fields: `url` (required), `avatar`, `feed`, `order_index`.
4. Tags become group chips on the card; `order_index` sorts ascending (empty
   values last).
5. Publish. There is no rebuild step.

The public list is deliberately **not** filtered by locale — a blogroll is one
list for the whole site. Entries store the locale they were authored in only so
their `/friends/<slug>` profile page gets the right prefix.

### Applications

The form renders when `friend_applications` exists (the migration is the opt-in,
like `/blogroll`). Submitting never publishes anything:

- Honeypot field `website`; one `pending` row per site URL (partial unique index);
  3 requests per salted IP hash per 24 hours.
- A best-effort probe fetches the applicant's site and records whether it links
  back (`reciprocal`: `ok` / `missing` / `unreachable`). It is shown in the queue
  as a hint, not enforced.
- `/admin` → **友链**: approve / reject / spam. Approval creates a published
  `friends` asset, assigns the next `order_index`, and stores its id in
  `friend_applications.asset_id`.

Applicants' email and IP hash never appear on the site and are never exported;
`friends` itself is a normal content kind, so it is part of the export bundle.
