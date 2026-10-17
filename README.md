# sprout

**A Cloudflare-native, data-portable personal content platform.**
Posts, notes, moments and comments — on SvelteKit, Cloudflare Workers, D1 (SQLite) and R2.

> 中文简介：一个「数据真正属于你」的个人内容平台。文章、笔记、动态、评论都存进标准 SQLite，
> 并且可以**完整导出成纯文本再恢复**——换掉 Cloudflare 也能带走。

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
| **Extensible** | Add a content type with one entry in `src/lib/content/registry.ts`; no schema change |
| **Comments** | Anonymous-first, signed cookie identity, moderation queue, rate limiting, honeypot, XSS-safe rendering |
| **Search** | SQLite FTS5 with bigram tokenization (works for Chinese) |
| **Analytics** | Self-hosted, cookie-free page views, aggregated per day |
| **Instant publish** | Write to the database, refresh, done — no rebuild |
| **Image upload** | Content-addressed keys in R2, served from your own `/media/<key>` route |
| **Bilingual** | English + Chinese routes out of the box (`/zh`) |
| **Portable** | Standard SQLite, relative media keys, append-only event log, full export contract |
| **Admin UI** | `/admin`: editor, live preview, uploads, moderation, stats |

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

Then set your own identity in **one file** — [`src/site.config.js`](./src/site.config.js):
site name, URL, author, brand copy, feature flags.

Deploy:

```bash
pnpm build
pnpm deploy
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

Everything about *who you are* lives in `src/site.config.js`:

```js
export const site = {
  name: 'your-site',
  url: 'https://your-domain.com',
  author: 'Your Name',
  locales: [{ code: 'en', label: 'English' }, { code: 'zh', label: '中文' }],
  brand: { en: { slogan: '…', … }, zh: { … } },
  features: { moments: true, comments: true, analytics: true, projects: true }
};
```

Everything about *the words on the page* lives in `src/lib/i18n/{en,zh}.js`.

## Content types

Declared in `src/lib/content/registry.ts`:

| type | route | notes |
|---|---|---|
| `post` | `/posts` | long-form articles |
| `note` | `/posts/notes` | short notes |
| `moment` | `/moments` | micro-blog / timeline |
| `project` | `/projects` | project cards |

Adding `link`, `photo`, `quote`… is one registry entry plus its content.

---

## Commands

| command | what it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm dev:clean` | kill stale dev processes + clear caches, then start |
| `pnpm bootstrap` | one-command Cloudflare setup |
| `pnpm check` | type check |
| `pnpm test` | unit tests (vitest) |
| `pnpm build` / `pnpm deploy` | build / deploy the Worker |
| `pnpm db:migrate:local` / `:remote` | apply migrations |
| `pnpm content:import` / `export` / `restore` / `verify` | content lifecycle |
| `pnpm check:links` / `check:sitemap` | crawl a running site for broken links / sitemap entries |

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — the three ideas behind the design
- [Data model](./docs/DATA-MODEL.md) — every table and why it exists
- [Export contract](./docs/EXPORT-CONTRACT.md) — the portability guarantee
- [Deploy guide](./docs/DEPLOY.md) — from clone to custom domain
- [Verification](./docs/VERIFY.md) — step-by-step checks, including a disaster-recovery drill

## Known limitations

- Runs on **Cloudflare only** (the data is portable; the runtime is not).
- **Two locales** (`en`/`zh`) are built in; more languages need another route tree.
- No newsletter, memberships or rich-text editor (Markdown + preview).
- Syntax highlighting happens in the browser, so code is plain text until JS loads.
- Comments are moderated manually — there is no email notification yet.

## License

[MIT](./LICENSE)
