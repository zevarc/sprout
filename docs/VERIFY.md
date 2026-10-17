# Verifying a sprout instance

Every step below has an expected result. If yours differs, jump to
[Troubleshooting](#troubleshooting).

Run everything from the project root.

## 1. Start locally

```bash
pnpm dev:clean     # kills stale dev processes and clears caches
pnpm dev
```

Expected: a local URL such as `http://localhost:5173/` (Vite may pick another port —
use the one it prints).

If this is a fresh database:

```bash
pnpm db:migrate:local
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:import
# expected: "Imported N nodes …"
```

## 2. Pages respond

```bash
for p in / /zh /posts /projects /moments /search /admin /feed.xml /sitemap.xml; do
  printf "%-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173$p)"
done
```

Expected: all `200`.

## 3. Comments

```bash
# anonymous comment → held for moderation
curl -s -X POST http://localhost:5173/api/events -H 'Content-Type: application/json' \
  -d '{"kind":"comment","targetType":"post","targetId":"<a node id>","name":"Tester","body":"hi"}'
# expected: {"ok":true,...,"status":"pending"}

# owner login (token comes from .dev.vars)
curl -s -X POST http://localhost:5173/api/auth/login \
  -H 'Content-Type: application/json' -d '{"token":"dev-admin-token"}' -c /tmp/sprout-cookie
# expected: {"ok":true,"role":"owner"}

# owner comments are auto-approved
curl -s -X POST http://localhost:5173/api/events -b /tmp/sprout-cookie \
  -H 'Content-Type: application/json' \
  -d '{"kind":"comment","targetType":"post","targetId":"<a node id>","body":"from the owner"}'
# expected: "status":"approved"
```

XSS check — raw HTML in a comment must be escaped:

```bash
curl -s -X POST http://localhost:5173/api/events -b /tmp/sprout-cookie \
  -H 'Content-Type: application/json' \
  -d '{"kind":"comment","targetType":"post","targetId":"<a node id>","body":"<script>alert(1)</script>"}' >/dev/null
curl -s "http://localhost:5173/api/events?kind=comment&targetType=post&targetId=<a node id>" | grep -o '&lt;script&gt;'
# expected: &lt;script&gt;
```

Rate limiting (per actor, 8 per 10 minutes) — reuse the cookie or every request is a
new visitor:

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w '%{http_code} ' -X POST http://localhost:5173/api/events \
    -c /tmp/rl.txt -b /tmp/rl.txt -H 'Content-Type: application/json' \
    -d '{"kind":"comment","targetType":"post","targetId":"<a node id>","name":"spam","body":"spam"}'
done; echo
# expected: 200 200 200 200 200 200 200 200 429 429 429 429
```

## 4. Admin

Open `/admin` in a browser, log in with `ADMIN_TOKEN`, and check the three tabs:

- **Content** — create a node, preview it, delete it.
- **Moderation** — approve the pending comment from step 3.
- **Stats** — page views aggregate after a few visits.

## 5. Search

```bash
curl -s --get --data-urlencode "q=hello" --data "lang=en" http://localhost:5173/api/search
# expected: a JSON list of matching nodes
```

## 6. The portability drill (the important one)

```bash
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:export
# expected: "Exported N files → export/"

ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:verify
# expected: "Mirror matches the database"

# simulate losing the cloud database
pnpm db:console:local "DELETE FROM nodes; DELETE FROM nodes_fts; DELETE FROM relations; DELETE FROM media; DELETE FROM events; DELETE FROM event_status; DELETE FROM actors; DELETE FROM actor_identities;"

ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:restore
ADMIN_TOKEN=dev-admin-token API_URL=http://localhost:5173 pnpm content:verify
# expected: node counts restored, "Mirror matches the database"
```

If all three pass, your data really can leave.

## 7. Code health

```bash
pnpm check     # expected: 0 errors, 0 warnings
pnpm test      # expected: all tests pass
pnpm build     # expected: adapter-cloudflare finishes
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every data route 500s with `no such table: nodes` | you changed `database_id`, which creates a new empty local DB | `pnpm db:migrate:local`, then `pnpm content:import` |
| 500 but another port works | an old dev server with a stale module graph | `pnpm dev:clean` |
| Wrong port | Vite auto-increments when busy | `pnpm dev --port 5180 --strictPort` |
| Code blocks have no colours in `curl` output | highlighting happens in the browser | open it in a browser |
| Counting `data-lang=` gives 2× the blocks | the page also embeds an escaped hydration copy | count `class="code-pre"` instead |
| `content:verify` reports drift | the export folder was not pruned (old files) | re-run `content:export` (it prunes) |
| Moderation state looks wrong after manual SQL | effective status = newest row by timestamp | use `/admin`, or insert a later timestamp |
