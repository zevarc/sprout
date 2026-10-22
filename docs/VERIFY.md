# Verifying a sprout instance

Every step has an expected result. If yours differs, see
[Troubleshooting](#troubleshooting). Run everything from the project root.

---

## 1. Start locally

```bash
pnpm dev:clean     # stop stale Vite/workerd processes and clear caches
pnpm dev
```

Expected: a URL such as `http://localhost:5173/` (Vite may pick another port — use
the one it prints).

Fresh local database:

```bash
pnpm db:migrate:local
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:import
# expected: "Imported N nodes …"
```

> The schema is one canonical `migrations/0001_init.sql`. If your local state
> predates it (or you changed `database_id`), delete `.wrangler/state` and re-run
> `pnpm db:migrate:local`; it becomes an empty local database.

---

## 2. Pages respond

```bash
for p in / /zh /posts /zh/posts /moments /zh/moments /projects /tags /about \
         /search /feed.xml /zh/feed.xml /sitemap.xml /admin; do
  printf "%-16s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173$p)"
done
```

Expected: all `200`.

Notes:

- `/moments` is served by the **generic** `feed` renderer.
- `/posts`, `/projects` are bespoke static overrides.
- A private type (or a private node) returns `404` to anonymous callers — that is
  expected.

---

## 3. Comments

```bash
# anonymous comment → pending
curl -s -X POST http://localhost:5173/api/events \
  -H 'Content-Type: application/json' \
  -d '{"kind":"comment","targetType":"post","targetId":"<node id>","name":"Tester","body":"hi"}'
# expected: {"ok":true,"id":"…","status":"pending"}

# owner login (token from .dev.vars)
curl -s -X POST http://localhost:5173/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"token":"dev-admin-token"}' -c /tmp/sprout-cookie
# expected: {"ok":true,"role":"owner"}

# owner comment → approved
curl -s -X POST http://localhost:5173/api/events -b /tmp/sprout-cookie \
  -H 'Content-Type: application/json' \
  -d '{"kind":"comment","targetType":"post","targetId":"<node id>","body":"from the owner"}'
# expected: "status":"approved"
```

XSS: raw HTML must be escaped.

```bash
curl -s -X POST http://localhost:5173/api/events -b /tmp/sprout-cookie \
  -H 'Content-Type: application/json' \
  -d '{"kind":"comment","targetType":"post","targetId":"<node id>","body":"<script>alert(1)</script>"}' >/dev/null
curl -s "http://localhost:5173/api/events?kind=comment&targetType=post&targetId=<node id>" \
  | grep -o '&lt;script&gt;'
# expected: &lt;script&gt;
```

Rate limit (8 per actor per 10 minutes; reuse the cookie or every request is a new
visitor):

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:5173/api/events \
    -c /tmp/rl.txt -b /tmp/rl.txt -H 'Content-Type: application/json' \
    -d '{"kind":"comment","targetType":"post","targetId":"<node id>","name":"spam","body":"spam"}'
done; echo
# expected: 200 200 200 200 200 200 200 200 429 429 429 429
```

---

## 4. Admin console

Open `/admin`, sign in with `ADMIN_TOKEN`, and check the tabs:

- **Content** — create, edit, preview, delete; filters and bulk publish/archive.
- **Moderation** — approve the pending comment from step 3.
- **Stats** — page views aggregate after a few visits.
- **Members** — generate an invite link (visible when `features` includes
  `members`).

Editor checks: unsaved-changes guard, local autosave, ⌘/Ctrl+S save,
⌘/Ctrl+Enter preview, split preview, pre-publish warnings.

---

## 5. Search

```bash
curl -s --get --data-urlencode "q=hello" --data "lang=en" \
  http://localhost:5173/api/search
# expected: {"results":[…]}
```

Chinese bigram check (with Chinese content imported):

```bash
curl -s --get --data-urlencode "q=构建" --data "lang=zh" \
  http://localhost:5173/api/search | head -c 400
```

---

## 6. Rendering, themes and sitemap

```bash
# generic renderer path: /moments uses the `feed` list layout
curl -s http://localhost:5173/moments | grep -o 'content-page' | head -1

# theme preview injects a token block
curl -s 'http://localhost:5173/?theme=warm' | grep -o 'data-sprout-theme' | head -1

# sitemap must advertise `/notes` as a list page (single-segment type)
BASE_URL=http://localhost:5173 pnpm check:sitemap
# expected: "Checked N unique URLs, 0 missing."
```

Also check:

- `/sitemap.xml` locations use `site.url`, not `example.com`;
- `?theme=classic` falls back to the base palette;
- `/zh/...` pages render Chinese UI and `<html lang="zh">`.

---

## 7. The portability drill (the important one)

```bash
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:export
# expected: "Exported N files → export/"

ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:verify
# expected: "Mirror matches the database"

# simulate losing the cloud database (keeps meta + migration tracking)
pnpm db:console:local "DELETE FROM asset_media; DELETE FROM media; DELETE FROM asset_tags; DELETE FROM tags; DELETE FROM reactions; DELETE FROM comments; DELETE FROM sessions; DELETE FROM invites; DELETE FROM identities; DELETE FROM people; DELETE FROM posts_fts; DELETE FROM notes_fts; DELETE FROM moments_fts; DELETE FROM projects_fts; DELETE FROM posts; DELETE FROM notes; DELETE FROM moments; DELETE FROM projects; DELETE FROM assets;"

ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:restore
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:verify
# expected: "Mirror matches the database"
```

If all three pass, your data really can leave. The export includes private media
and salted hashes — keep the folder private.

---

## 8. Code health

```bash
pnpm check     # expected: 0 errors, 0 warnings
pnpm test      # expected: all tests pass
pnpm build     # expected: adapter-cloudflare finishes
```

The test suite includes architecture guards:

- routes contain no `db.prepare` / `query` / `run` / `first`;
- components contain no hex/rgba colour literals.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every data route 500s: `no such table: assets` | changed `database_id` → new empty local DB | `pnpm db:migrate:local`, then `pnpm content:import` |
| 500 but another port works | stale dev server / module graph | `pnpm dev:clean` |
| Wrong port | Vite auto-increments when busy | `pnpm dev --port 5180 --strictPort` |
| Code blocks have no colours in `curl` output | highlighting is browser-side | open it in a browser |
| Counting `data-lang=` gives 2× the blocks | the page embeds an escaped hydration copy | count `class="code-pre"` instead |
| `content:verify` reports drift | export folder not pruned / new writes | re-run `content:export` (it prunes) |
| Moderation state looks wrong after manual SQL | the state is one `comments.status` column | use `/admin`, or set the column |
| `check:sitemap` hits production | it defaults to `site.url` | pass `BASE_URL=http://localhost:5173` |
| Private page 404 while logged out | expected | sign in as owner/member |
