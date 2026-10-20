# Data import and export

sprout's portability is a concrete contract: **export → verify → restore**.
The export is a plain-text snapshot; media are files. The exact format is
specified in [EXPORT-CONTRACT](./EXPORT-CONTRACT.md).

---

## 1. Environment

All scripts read:

| Variable | Meaning | Default |
|---|---|---|
| `API_URL` | Running instance | `http://localhost:5173` |
| `ADMIN_TOKEN` | Admin token (from `.dev.vars` or a Worker secret) | — |

`content:import` additionally reads `IMPORT_BATCH` (default `8`).

```bash
export API_URL=https://your-domain.com
export ADMIN_TOKEN=<token>
```

---

## 2. Export

```bash
pnpm content:export [dir]                 # default ./export
pnpm content:export ./export --no-media   # skip media binaries
```

Behaviour:

1. **Prunes the target directory first**, so the folder is an exact snapshot (no
   files from deleted content linger).
2. Refuses to export into the project root, `/`, or the home directory.
3. Calls `GET /api/admin/export` and writes every text file.
4. Downloads each media object from `GET /media/<key>` with
   `Authorization: Bearer $ADMIN_TOKEN` (private media requires it). A failed
   download prints a warning instead of silently dropping the file.

Output:

```
export/
  schema.json                 # format version, db_schema, table list
  nodes.jsonl                 # one node per line (extra parsed)
  relations.jsonl             # ad-hoc edges only
  media.jsonl                 # media metadata (binaries in media/)
  events.jsonl                # interactions + structured payload
  event_status.jsonl          # full moderation history
  actors.jsonl
  actor_identities.jsonl
  nodes/<type>/<slug>.<lang>.md   # human-readable mirror
  media/<sha256>.<ext>            # binaries
```

Not exported: `sessions`, `stats_daily`, `invites`, and FTS internal tables.
`body_html` is not exported either (it is derived); comment HTML is never stored.

---

## 3. File schemas

### `nodes.jsonl`

| Field | Notes |
|---|---|
| `id` | Opaque ULID |
| `type`, `slug`, `lang` | Human identity; unique together |
| `group_id` | Translation/series group (opaque) |
| `title`, `summary` | Nullable |
| `body_md` | Source Markdown |
| `status` | `draft` \| `scheduled` \| `published` \| `archived` |
| `published_at`, `occurred_at` | ISO-8601 or null |
| `visibility` | `public` \| `private` |
| `author_actor_id` | Nullable |
| `created_at`, `updated_at` | ISO-8601 |
| `extra` | Parsed JSON object |

### `relations.jsonl`

`{ from_id, to_id, rel }` — ad-hoc edges only (translations are derived from
`group_id`, so no translation rows exist).

### `media.jsonl`

`{ id, node_id, r2_key, kind, width, height, alt, position, sha256 }`.
`r2_key` is relative; the binary lives at `media/<r2_key>`.

### `events.jsonl`

`{ id, kind, target_type, target_id, actor_id, parent_id, body_md, payload, created_at }`.
`payload` holds structured metadata (`ipHash`, emoji, …); it never contains
rendered HTML.

### `event_status.jsonl`

`{ event_id, status, at, by }` — append-only; the newest row wins.

### `actors.jsonl` / `actor_identities.jsonl`

`actors`: `{ id, kind, handle, display_name, avatar_url, email_hash, created_at }`.
`actor_identities`: `{ actor_id, provider, provider_uid }`.

### `nodes/<type>/<slug>.<lang>.md`

A human-readable mirror with frontmatter:

```
---
id: …
type: post
slug: hello
lang: en
group_id: …
title: "Hello"
summary: "…"
status: published
published_at: 2026-01-01T00:00:00.000Z
occurred_at:
visibility: public
author_actor_id:
created_at: …
updated_at: …
extra: {"tags":["a"]}
---
body markdown
```

Restore ignores the Markdown mirror (it reads the JSONL); the mirror exists for
humans and diffs.

---

## 4. Determinism

- Rows are sorted by primary key; JSON object keys are sorted; timestamps are
  ISO-8601.
- Two consecutive exports of an unchanged database are **byte-identical**, so the
  folder works as a git mirror with clean diffs.
- The export format version is **2**; `schema.json` also carries
  `db_schema` (from `meta.schema_version`). Restore refuses a newer format.

---

## 5. Verify

```bash
pnpm content:verify [dir]
```

It re-exports and compares every text file with the local folder:

- missing in the mirror;
- content changed;
- extra files in the mirror.

It prints each difference and exits non-zero on drift. The `media/` directory is
skipped (binaries are verified by re-exporting them).

A typical automation loop: `export` (prunes) → `verify` → commit the mirror.

---

## 6. Restore

```bash
pnpm content:restore [dir]
```

Preconditions: the target database is **empty** and migrations have been applied.

Flow:

1. Sends the text files to `POST /api/admin/restore`.
2. Writes actors → identities → nodes → relations → media → events →
   `event_status`.
3. Uses `INSERT … ON CONFLICT DO UPDATE` (never `INSERT OR REPLACE`, which would
   delete-and-reinsert and cascade children away under foreign keys).
4. Re-renders `body_html` from `body_md` and rebuilds `nodes_fts`.
5. Re-uploads media binaries with `record=0` (metadata already restored from
   `media.jsonl`).
6. Invalidates derived caches.

Restore checks `schema.json.version`; an export from a newer build is rejected.

### Disaster recovery / move to another host

```bash
# old instance
pnpm content:export ./export

# new instance: empty DB + migrations
pnpm exec wrangler d1 migrations apply <DB_NAME> --remote
pnpm build && pnpm run deploy

# restore and verify
API_URL=https://new-domain pnpm content:restore ./export
API_URL=https://new-domain pnpm content:verify ./export
```

Because the export has no vendor references, the same folder restores into any
SQLite-backed host once the D1 adapter is replaced.

---

## 7. Mirror automation (recipe)

The repository does not ship a mirror workflow, but the scripts are designed for
one. A scheduled job needs four secrets:

| Secret | Purpose |
|---|---|
| `API_URL` | Production origin |
| `ADMIN_TOKEN` | Admin token |
| `MIRROR_REPO` | A **private** repository |
| `MIRROR_TOKEN` | Token with push access |

Sketch:

```yaml
on:
  schedule: [{ cron: '0 3 * * *' }]
jobs:
  mirror:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm content:export ./export
        env: { API_URL: '${{ secrets.API_URL }}', ADMIN_TOKEN: '${{ secrets.ADMIN_TOKEN }}' }
      - run: pnpm content:verify ./export
        env: { API_URL: '${{ secrets.API_URL }}', ADMIN_TOKEN: '${{ secrets.ADMIN_TOKEN }}' }
      # push ./export to MIRROR_REPO with MIRROR_TOKEN
```

> The mirror is **private data**: it contains private media and salted hashes
> (`actors.email_hash`, `events.payload.ipHash`) and comments in every moderation
> state.

---

## 8. Import (Markdown / seed content)

```bash
pnpm content:import [--replace] [--only=post]
```

Sources:

- `src/content/posts/*.md` → type `post`
- `src/content/notes/*.md` → type `note`
- `scripts/seed-projects.json` → type `project` (optional body in
  `src/content/projects/<slug>.<lang>.md`)

### Filenames and frontmatter

- `<slug>.<lang>.md` → slug + language (`hello.zh.md` → `hello`, `zh`); no suffix
  means `en`.
- Frontmatter parsed: `title`, `description`, `date`, `updated`, `draft`, `tags`,
  `cover`.

### Idempotency and grouping

- Node ids are generated server-side (ULID); import is keyed on
  `(type, slug, lang)`.
- Within one run, the same `(type, slug)` shares a `group_id` (translations).
- Batching (`IMPORT_BATCH`) never splits a group because the id travels with each
  node.
- `--replace` deletes and recreates an existing node; the default updates it.
- `--only=post|note|project` limits the run.

### HTTP form

```bash
curl -X POST "$API_URL/api/admin/import" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nodes":[{"type":"post","slug":"hello","lang":"en",
       "bodyMd":"# Hi","status":"published"}],"replace":false}'
# → {"ok":true,"count":1,"ids":["01H…"]}
```

The server renders `body_html`, indexes FTS, and invalidates derived output.

---

## 9. Privacy and security

The export is a full log:

- `actors.email_hash` — salted SHA-256 of commenter emails;
- `events.payload.ipHash` — salted, per-day IP hash;
- comments in `pending`, `spam` and `deleted` states;
- **private media binaries**.

Treat the export folder and any mirror as private. If you need a public mirror,
strip these fields or keep it in a private repository.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Private media missing / warnings on export | missing `ADMIN_TOKEN` | set it; scripts send `Bearer` |
| `content:verify` reports drift | folder not pruned / new writes | re-run `content:export`, then `verify` |
| Restore rejects the bundle | export format newer than the build | upgrade the code first |
| Duplicated content after restore | target DB was not empty | reset the DB, then restore |
| Imported dates look wrong | missing/invalid frontmatter `date` | add an ISO-8601 `date` |
| Private content 404 after restore | anonymous request | sign in as owner/member; 404 is expected otherwise |
