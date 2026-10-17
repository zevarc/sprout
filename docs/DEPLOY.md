# Deploy guide

From a clone to a live site on your own domain.

## 0. Prerequisites

- Node 20+, pnpm 9+
- A Cloudflare account
- `pnpm exec wrangler login`

## 1. Install and configure

```bash
git clone https://github.com/zevarc/sprout.git
cd sprout
pnpm install
```

Edit **`src/site.config.js`** — site name, `url`, author, brand copy, feature flags.
This is the only file you must change to make the site yours.

For local development you also need a `.dev.vars` file:

```bash
cp .dev.vars.example .dev.vars
```

## 2. One-command Cloudflare setup

```bash
pnpm bootstrap
```

It will:

1. verify your wrangler login;
2. create a D1 database and write its `database_id` into `wrangler.toml`;
3. create an R2 bucket;
4. generate and upload `ADMIN_TOKEN`, `SESSION_SECRET`, `IP_HASH_SALT`;
5. write `.dev.vars` with the same values;
6. apply migrations to the remote database.

Preview it first with `pnpm bootstrap --dry-run` (changes nothing).

> The script defaults to the names already in `wrangler.toml`. Override them with
> `--name`, `--db`, `--bucket`.

## 3. Deploy

```bash
pnpm build
pnpm run deploy
```

> pnpm ships its own `deploy` command, so the script must be invoked as
> `pnpm run deploy` — `pnpm deploy` alone will not run it.

## 4. Custom domain

In the Cloudflare dashboard: **Workers & Pages → your Worker → Settings → Domains &
Routes → Add custom domain**.

> ⚠️ The Worker name in `wrangler.toml` (`name = "sprout"`) **is** the Worker's
> identity. Renaming it creates a new Worker and detaches the custom domain.

## 5. Import content

```bash
ADMIN_TOKEN=<value from .dev.vars> API_URL=https://your-domain.com pnpm content:import
```

Then open `https://your-domain.com/admin`, paste the same token, and start writing.

## 6. Optional: GitHub login for commenters

Create an OAuth app at GitHub → Settings → Developer settings → OAuth Apps:

- Homepage URL: `https://your-domain.com`
- Callback URL: `https://your-domain.com/api/auth/github/callback`

Then:

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

Without these, `/api/auth/github` returns `501` and anonymous comments still work.

## 7. Optional: IndexNow

IndexNow pushes new URLs to Bing/Yandex on deploy.

1. Generate a key, put it in `static/<key>.txt` (the file content is the key).
2. `pnpm exec wrangler secret put INDEXNOW_KEY`
3. `pnpm run deploy && pnpm notify:indexnow`

## Local gotcha: changing `database_id`

Local dev stores D1 under `.wrangler/state`, keyed by a **hash of `database_id`**.
Changing that id creates a fresh, empty local database — every route will then fail
with `no such table: nodes`. Fix it with:

```bash
pnpm db:migrate:local
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:import
```

## Upgrading an existing deployment

```bash
git pull
pnpm install
pnpm db:migrate:remote
pnpm build && pnpm run deploy
```
