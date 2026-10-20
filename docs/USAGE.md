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

### 2.1 `src/site.config.js` — identity

| Key | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Used in titles, nav, footer, JSON-LD |
| `url` | string | yes | No trailing slash. Drives canonical, hreflang, sitemap, OG, RSS |
| `author` | string | yes | Structured-data author |
| `contact.email` | string | yes | About page / footer |
| `contact.github` | string | yes | About page / footer / `sameAs` |
| `locales` | `{ code, label }[]` | yes | First is the default unless `defaultLocale` is set |
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

### 2.2 `src/sprout.config.js` — assembly

| Export | Type | Notes |
|---|---|---|
| `contentTypes` | `Record<string, ContentTypeDef>` | The site's types |
| `features` | `string[]` | Known ids: `comments`, `members`, `analytics`, `timeline` |
| `home` | `{ sections: HomeSection[] }` | Home page composition |
| `theme` | `{ name, tokens }` | `classic` / `mono` / `warm`, plus token overrides |
| `privateRoutes` | `string[]` | Non-type paths that require a session |
| `content` | `{ defaultVisibility, timelineOrder }` | Defaults for new nodes |
| `mods` | `Mod[]` | Data contributions merged into the assembly |

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
optional `fields: string[]` (which `extra` keys cards display).

`Mod`: `id` (required), optional `contentTypes`, `features`, `home.sections`,
`theme.tokens`, `i18n`.

---

## 3. Content types

### 3.1 Adding a type

```js
// src/sprout.config.js
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

No migration and no route files. If the route is multi-segment
(`/posts/notes`), provide static routes instead.

### 3.2 Declarative fields

`fields` describes what a type carries, and is stored in `nodes.extra`.
The server does **not** enforce an `extra` schema, and the admin editor has
bespoke inputs for the built-in types. Custom fields for a new type are written
through the API or import (or by extending the editor).

### 3.3 Renderers

| Key | Layout | Used for |
|---|---|---|
| `list` | date + title + excerpt rows | articles, notes |
| `cards` | card grid (title/excerpt/date/tags) | projects, links |
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
      fields: ['year', 'status', 'website', 'github'] }
  ]
};
```

- Each section selects declared types; featured nodes win, otherwise the latest.
- `title` / `more` are dotted keys in `src/lib/i18n/*.js`.
- `fields` applies to `cards` and reads `node.extra[key]`.
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

### Token reference (main groups)

| Group | Tokens |
|---|---|
| Paper/ink | `--color-paper`, `--color-paper-deep`, `--color-paper-line`, `--color-ink`, `--color-ink-soft`, `--color-ink-faint` |
| Accent | `--color-bud`, `--color-bud-deep`, `--color-bud-soft`, `--color-bud-pale`, `--color-sprout`, `--color-sprout-deep`, `--color-sprout-pale` |
| Surfaces | `--color-surface`, `--color-on-surface`, `--color-surface-container`, `-low`, `-high`, `--color-primary`, `--color-on-primary`, `--color-primary-container`, `--color-on-primary-container`, `--color-error`, `--color-outline` |
| Background art | `--grid-line`, `--grad-bud-a`, `--grad-bud-b`, `--grad-bud-c` |
| Typography | `--font-serif`, `--font-sans`, `--font-mono` |
| Layout | `--content-max-width`, `--content-padding` |
| Elevation | `--shadow-soft`, `--shadow-float`, `--shadow-glow`, `--shadow-card` |

---

## 6. Languages

Add a language:

1. Add `{ code: 'ja', label: '日本語' }` to `site.locales`.
2. Add `src/lib/i18n/ja.js` with the same keys as `en.js`.
3. Register it in `src/lib/i18n/index.js` (`dictionaries`).
4. Add a `brand.ja` entry in `site.config.js` (optional but recommended).

URL scheme: the default locale lives at the root (`/posts/x`); every other locale
is a prefix (`/ja/posts/x`). No route files are needed. Always build links with
`getLink(path, lang)` / `homePath(lang)`, and resolve the active locale with
`localeFromPath(pathname)`.

i18n key groups: `nav`, `home`, `posts`, `search`, `comments`, `moments`,
`projects`, `tags`, `about`, `seo`, `common.empty`, `language`.

---

## 7. Private content and members

- `nodes.visibility`: `public` | `private`; the default comes from
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

- `features: ['timeline']` enables `/timeline` (private by default: it is added to
  the guarded prefixes when the feature is on).
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
**occurred time** and **visibility**, pre-publish warnings (empty slug, empty
summary, missing alt, heading level skips, duplicate slug), slug-change
confirmation, media panel (alt/reorder/delete), translation pairing (same
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

## 11. Search

- `/search` and `/search?q=…` (linkable).
- Server-side FTS5 with bigram tokenization; two-character Chinese words match.
- Anonymous search only returns public nodes.

```bash
curl -s --get --data-urlencode "q=构建" --data "lang=zh" \
  https://your-domain/api/search
```

## 12. Analytics

- Cookie-free, self-hosted; aggregated to `stats_daily` (day, path, referrer,
  views).
- Disable by removing `analytics` from `features` (the beacon stops and the
  endpoint returns `{ok:true}` without writing).
- Not part of the content export.

---

## 13. Authoring

- Online: `/admin` → Content → New. Markdown with preview.
- Markdown support: headings (TOC anchors), fenced code (copy button,
  browser-highlighted), images (lazy), links, lists, blockquotes.
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

// src/sprout.config.js
import family from './mods/family.js';
export const mods = [family];
```

### Override a type's markup

Create `src/routes/links/+page.svelte` and `+page.server.ts`; the static route wins
over `[type]`. Keep reads/writes in the domain layer (the architecture guard
enforces this).

### Add a language

See §6. No route files are needed.
