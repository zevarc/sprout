# Deployment

From a clone to a live site on Cloudflare Workers + D1 + R2. Configuration is in
[USAGE](./USAGE.md); data migration in [DATA-IMPORT-EXPORT](./DATA-IMPORT-EXPORT.md).

---

## 0. Prerequisites

- Node 20+, pnpm 9+
- A Cloudflare account with Workers, D1 and R2
- `pnpm exec wrangler login` completed
- `pnpm install`

Verify the account:

```bash
pnpm exec wrangler whoami
# expected: your account name/id and a token with workers/d1/r2 write access
```

---

## 1. Configure the site

Two files:

1. **`src/site.config.js`** — identity. Set `name`, `url` (the final origin, no
   trailing slash), `author`, `contact`, `locales`, `defaultLocale`, `brand`.
2. **`src/sprout.config.js`** — assembly. Declare types, features, home sections,
   theme, mods.

`url` drives canonical URLs, hreflang, sitemap, OG and RSS. A wrong value makes
search engines index the wrong host.

---

## 2. One-command Cloudflare setup

```bash
pnpm bootstrap --dry-run   # prints the plan, changes nothing
pnpm bootstrap             # creates resources and writes config back
```

`scripts/setup.mjs` performs:

1. `wrangler whoami` (fails fast if not logged in);
2. `wrangler d1 create <db>` → parses `database_id` and writes
   `database_name` / `database_id` into `wrangler.toml`;
3. `wrangler r2 bucket create <bucket>` → writes `bucket_name`;
4. generates and uploads `ADMIN_TOKEN`, `SESSION_SECRET`, `IP_HASH_SALT`
   (32/32/16 random bytes, hex);
5. writes `.dev.vars` with the same values (gitignored);
6. `wrangler d1 migrations apply DB --remote` (the canonical `0001_init.sql`).

Flags / defaults:

| Flag | Default |
|---|---|
| `--name` | `name` in `wrangler.toml` |
| `--db` | `database_name` in `wrangler.toml` |
| `--bucket` | `bucket_name` in `wrangler.toml` |
| `--dry-run` | off |

In a non-interactive shell it uses the defaults/flags and prints each choice.

> `pnpm bootstrap` avoids `pnpm setup` because pnpm has a built-in `setup`.

---

## 3. Build and deploy

```bash
pnpm check && pnpm test && pnpm build
pnpm run deploy
```

- `wrangler.toml` points at `.svelte-kit/cloudflare/_worker.js` and the asset
  directory.
- `pnpm deploy` is a pnpm built-in; **use `pnpm run deploy`**.
- On success wrangler prints the Worker URL and bindings (`DB`, `MEDIA`,
  `ASSETS`).

---

## 4. Custom domain / routes

### Custom domain

Cloudflare dashboard → **Workers & Pages → your Worker → Settings → Domains &
Routes → Add custom domain**. This creates the DNS record and certificate.

> ⚠️ The `name` in `wrangler.toml` **is** the Worker identity. Renaming it creates
> a new Worker and detaches domains.

### Worker route (when DNS must not change)

If the apex already has a proxied A/CNAME pointing at an origin that does not
answer, a custom domain attach can return **522** and the API reports
`code: 100117`. Use a route instead:

```toml
workers_dev = true
[[routes]]
pattern = "your-domain/*"
zone_name = "your-domain"    # required, otherwise "Can't infer zone from route"
```

A route hands requests to the Worker at the edge without touching DNS.

---

## 5. Secrets

| Secret | Purpose | Required |
|---|---|---|
| `ADMIN_TOKEN` | owner login + machine API (`Bearer`) | yes |
| `SESSION_SECRET` | signs session cookies / invite tokens | yes |
| `IP_HASH_SALT` | salted email/IP hashes | yes |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional GitHub login | no |
| `INDEXNOW_KEY` | optional IndexNow submissions | no |

```bash
pnpm exec wrangler secret put ADMIN_TOKEN
pnpm exec wrangler secret put SESSION_SECRET
pnpm exec wrangler secret put IP_HASH_SALT
pnpm exec wrangler secret list
```

Secrets persist across deploys and are independent of the database.

---

## 6. Optional: GitHub login

See [GITHUB-LOGIN](./GITHUB-LOGIN.md). Without the two secrets, the login endpoint
returns `501` and the comment form hides the button; anonymous comments still work.

## 7. Optional: IndexNow

1. Generate a key; put `static/<key>.txt` containing the key.
2. `pnpm exec wrangler secret put INDEXNOW_KEY`
3. After deploy: `BASE_URL=https://your-domain pnpm notify:indexnow`

---

## 8. Local development

```bash
cp .dev.vars.example .dev.vars      # or let pnpm bootstrap generate it
pnpm db:migrate:local
pnpm dev                            # http://localhost:5173
```

Seed the local DB:

```bash
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:import
```

Notes:

- Local D1 lives in `.wrangler/state`, keyed by a hash of `database_id`. Changing
  that id creates a fresh, empty local database.
- If routes start 500ing after renaming/moving route files, run `pnpm dev:clean`
  (kills stale Vite/workerd processes and clears caches).

---

## 9. Upgrading

Normal upgrade:

```bash
git pull
pnpm install
pnpm db:migrate:remote
pnpm check && pnpm test && pnpm build
pnpm run deploy
```

After a renderer change, rebuild the derived HTML:

```bash
curl -X POST https://your-domain/api/admin/rerender \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# {"ok":true,"scanned":N,"updated":M,"skipped":K}   (idempotent)
```

It only rewrites `nodes.body_html`; source Markdown and timestamps are untouched.

### Schema rewrite (this release)

This version folds 0002/0003 into one canonical `0001_init.sql`. An older database
cannot simply run `migrations apply`. Migrate through the export contract:

```bash
# 1) back up from the old instance
ADMIN_TOKEN=… API_URL=https://old-domain pnpm content:export ./export

# 2) drop everything (including migration tracking) on the target DB
cat > /tmp/sprout-reset.sql <<'SQL'
PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS nodes_fts;
DROP TABLE IF EXISTS stats_daily;
DROP TABLE IF EXISTS event_status;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS relations;
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS actor_identities;
DROP TABLE IF EXISTS actors;
DROP TABLE IF EXISTS meta;
DROP TABLE IF EXISTS d1_migrations;
SQL
pnpm exec wrangler d1 execute <DB_NAME> --remote --file /tmp/sprout-reset.sql

# 3) apply the canonical schema
pnpm exec wrangler d1 migrations apply <DB_NAME> --remote

# 4) deploy the new code
pnpm build && pnpm run deploy

# 5) restore and verify
ADMIN_TOKEN=… API_URL=https://new-domain pnpm content:restore ./export
ADMIN_TOKEN=… API_URL=https://new-domain pnpm content:verify ./export
```

Restore expects an empty database and uses UPSERT; it re-renders HTML and
re-uploads media.

### Rollback

There is no automated rollback. Keep the export folder (and the git mirror) from
before the upgrade; to go back, deploy the previous commit and restore that
export into a fresh database.

---

## 10. The official demo

The repository ships a second, independent Worker config:

```bash
pnpm build
pnpm run deploy:demo        # wrangler.demo.toml
```

| Setting | Value |
|---|---|
| Worker | `sprout-demo` |
| D1 | `sprout-demo` (`df9358dd-…`) |
| R2 | `sprout-demo-media` |
| Domain | `sprout.zevarc.com` (custom domain) |

Its secrets are separate:

```bash
pnpm exec wrangler secret put ADMIN_TOKEN --config wrangler.demo.toml
```

When forking, either point `wrangler.demo.toml` at your own resources or delete it
and the `deploy:demo` script.

---

## 11. CI

`.github/workflows/ci.yml` runs on push/PR:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

All three must pass.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every data route 500s: `no such table: nodes` | `database_id` changed → empty local DB | `pnpm db:migrate:local`, then `pnpm content:import` |
| 500 on one port, another works | stale dev server / module graph | `pnpm dev:clean` |
| `pnpm deploy` does nothing | pnpm built-in | `pnpm run deploy` |
| Custom domain returns 522 | apex A/CNAME points at a dead origin | remove the record, or use a Worker route |
| `migrations apply` does nothing after a schema rewrite | migration tracking still says `0001` applied | drop tables + `d1_migrations`, re-apply |
| Private media 401/404 | request lacks `ADMIN_TOKEN` | set it; scripts send `Bearer` |
| Boot fails with a config error | invalid type route/locale/feature/renderer/mod | read the error and fix `site.config.js` / `sprout.config.js` |
| Theme has no effect | overridden by `?theme=`, or a typo in the token name | remove the query; check `--token` names |
| GitHub login 501 | secrets missing | set both client id and secret |
