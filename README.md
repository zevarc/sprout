# sprout

**A Cloudflare-native, data-portable personal content platform.**
Posts, notes, moments and comments — on SvelteKit, Cloudflare Workers, D1 (SQLite) and R2.

**Live demo: <https://sprout.zevarc.com>** · Real-world example: <https://zevarc.com>

---

## Why another personal site?

Most options force a choice:

- **Static generators** (Hugo, Astro) — great data ownership, but no comments, no admin UI, no instant publishing.
- **Comment services** (Giscus, utterances) — zero ops, but your readers' comments live in GitHub.
- **Full platforms** (Ghost, WordPress) — batteries included, but a server to run and a schema you don't control.

sprout takes the position that **the data is the product**. Everything lives in a
standard SQLite database (Cloudflare D1), media is referenced by relative key, and
an explicit **export → restore → verify** loop proves the data can leave at any time.

```bash
pnpm content:export   # → plain JSONL + Markdown + media files
pnpm content:restore  # rebuilds a database from that folder
pnpm content:verify   # proves the live DB and the mirror still match
```

---

## Features

| | |
|---|---|
| **Content** | Posts, notes, moments (micro-blog) and projects — all one typed content model |
| **Extensible** | Add a type in `src/sprout.config.js`; a single-segment route gets generic `/[type]` pages with a chosen renderer (`list` / `cards` / `feed`) — no schema change, no new route files |
| **Private** | Per-node `visibility`; private content and its media are owner/member-only |
| **Members** | Single-use invite links sign family or co-authors in as `member` — no accounts |
| **Timeline** | A merged `/timeline` across every type, ordered by when things happened |
| **Comments** | Anonymous-first, signed cookie identity, moderation queue, rate limiting, honeypot, XSS-safe rendering |
| **Search** | SQLite FTS5 with bigram tokenization (works for Chinese) |
| **Analytics** | Self-hosted, cookie-free page views, aggregated per day |
| **Instant publish** | Write to the database, refresh, done — no rebuild |
| **Image upload** | Content-addressed keys in R2, served from your own `/media/<key>` route |
| **Locales** | `site.locales` drives everything; `en` + `zh` out of the box, single-language sites need no `/zh` tree |
| **Portable** | Standard SQLite, relative media keys, append-only event log, full export contract |
| **Admin UI** | `/admin`: editor (autosave, split preview, pre-publish checks), uploads, moderation, stats, members |

## Stack

SvelteKit · Cloudflare Workers (`adapter-cloudflare`) · D1 (SQLite) · R2 · TypeScript · Vitest

---

## Quick start

Requirements: Node 20+, pnpm 9+, a Cloudflare account, `wrangler login` done.

```bash
git clone https://github.com/zevarc/sprout.git
cd sprout
pnpm install

pnpm bootstrap     # creates D1 + R2, generates secrets, writes .dev.vars, migrates
pnpm dev           # http://localhost:5173
```

Then make it yours in **two files**:

- [`src/site.config.js`](./src/site.config.js) — name, URL, author, contact, locales, brand.
- [`src/sprout.config.js`](./src/sprout.config.js) — content types, features, home sections, theme, mods.

Deploy:

```bash
pnpm build
pnpm run deploy
```

Import the sample content:

```bash
ADMIN_TOKEN=<from .dev.vars> API_URL=https://your-domain.com pnpm content:import
```

Open `/admin`, paste the same `ADMIN_TOKEN`, and start writing.

### Local-only development (no Cloudflare writes)

```bash
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev:clean
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:import
```

---

## Configuration

*Who you are* lives in `src/site.config.js`:

```js
export const site = {
  name: 'your-site',
  url: 'https://your-domain.com',
  author: 'Your Name',
  contact: { email: '…', github: '…' },
  locales: [{ code: 'en', label: 'English' }, { code: 'zh', label: '中文' }],
  defaultLocale: 'en',
  brand: { en: { claim: '…', creed: […], seoTitle: '…', … }, zh: { … } }
};
```

*What the site is made of* lives in `src/sprout.config.js`:

```js
export const contentTypes = { /* types + fields */ };
export const features = ['comments', 'members', 'analytics', 'timeline'];
export const home = { sections: [ /* types, layout, limit */ ] };
export const theme = { name: 'classic', tokens: {} };   // classic | mono | warm
export const privateRoutes = [];
export const content = { defaultVisibility: 'public', timelineOrder: 'published' };
export const mods = [];                                  // contributions
```

- **Types are capabilities**: declaring a type gives it routes; there is no
  `features.moments` boolean.
- **Renderers**: a type picks `listRenderer` (`list` | `cards` | `feed`) and
  `detailRenderer` (`article` | `compact`); bespoke looks are static-route overrides.
- **Theme**: token-only components; pick a preset or override any `--token`. Preview
  with `?theme=mono`.

*The words on the page* live in `src/lib/i18n/{en,zh}.js`.

## Content types

Declared in `src/sprout.config.js`:

| type | route | rendering |
|---|---|---|
| `post` | `/posts` | bespoke list + article detail (static routes) |
| `note` | `/posts/notes` | multi-segment; bespoke detail routes |
| `moment` | `/moments` | generic `feed` list + `compact` detail |
| `project` | `/projects` | bespoke list + detail (static routes) |

Adding `link`, `photo`, `quote`… is one entry plus its content. A **single-segment**
route gets generic `/[type]` pages automatically; a multi-segment route is served by its
own static routes.

---

## Commands

| command | what it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm dev:clean` | kill stale dev processes + clear caches, then start |
| `pnpm bootstrap` | one-command Cloudflare setup |
| `pnpm check` | type check |
| `pnpm test` | unit tests (vitest) |
| `pnpm build` / `pnpm run deploy` | build / deploy the Worker |
| `pnpm run deploy:demo` | deploy the independent demo Worker |
| `pnpm db:migrate:local` / `:remote` | apply migrations |
| `pnpm content:import` / `export` / `restore` / `verify` | content lifecycle |
| `pnpm check:links` / `check:sitemap` | crawl a running site for broken links / sitemap entries |
| `pnpm notify:indexnow` | submit the sitemap to IndexNow (optional) |

## Documentation

- [Design philosophy](./docs/PHILOSOPHY.md) — why the data is the product
- [Architecture](./docs/ARCHITECTURE.md) — layers, config assembly, routing, renderers, themes
- [Implementation](./docs/IMPLEMENTATION.md) — modules, request/write lifecycles, guarantees
- [Usage](./docs/USAGE.md) — configuring, writing, admin, members, search
- [Deploy](./docs/DEPLOY.md) — clone → Cloudflare → custom domain → upgrades
- [Data import/export](./docs/DATA-IMPORT-EXPORT.md) — export → verify → restore, Markdown import
- [Data model](./docs/DATA-MODEL.md) — every table and why it exists
- [Export contract](./docs/EXPORT-CONTRACT.md) — the portability guarantee
- [Verification](./docs/VERIFY.md) — step-by-step checks, including a disaster-recovery drill
- [GitHub login](./docs/GITHUB-LOGIN.md) — optional OAuth for commenters

## Known limitations

- Runs on **Cloudflare only** (the data is portable; the runtime is not).
- **Any number of languages** are supported from one route tree (`site.locales` drives
  links, feeds, sitemap, `hreflang` and the HTML `lang`); adding one needs a dictionary,
  not a route tree. Translated pieces are grouped (`group_id`), so each language may use
  its own slug.
- Generic list/detail pages cover **single-segment** type routes; a multi-segment route
  (`/posts/notes`) needs its own static pages.
- `fields` in `sprout.config.js` is declarative: the admin form has bespoke inputs for
  the built-in types; custom fields for a new type go through the API/import.
- No newsletter/subscriptions or rich-text editor (Markdown + preview).
- Syntax highlighting happens in the browser, so code is plain text until JS loads.
- Comments are moderated manually — there is no email notification yet.

## License

[MIT](./LICENSE)
