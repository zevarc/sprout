# Export contract

This is the promise that makes sprout portable: **everything needed to rebuild the
site can be written to a folder of plain text**, and restored from it.

```
export/
  schema.json                 # format version + table list
  nodes.jsonl                 # one JSON object per node (with parsed `extra`)
  relations.jsonl
  media.jsonl                 # metadata only; binaries live in media/
  events.jsonl                # includes payload (rendered HTML, hashed IP)
  event_status.jsonl          # full moderation history
  actors.jsonl
  actor_identities.jsonl
  nodes/<type>/<slug>.<lang>.md   # human-readable mirror, one file per node
  media/<sha256>.<ext>            # binaries fetched from /media/<key>
```

## Guarantees

1. **Deterministic.** Rows are sorted by primary key; JSON object keys are sorted;
   timestamps are already ISO-8601. Two consecutive exports of an unchanged database
   produce byte-identical files, so the folder works as a git mirror with clean diffs.
2. **Complete for content.** Nodes, relations, media metadata, events, moderation
   history and actors are all included. `body_html` is excluded because it is derived —
   restore re-renders it from `body_md` and the result is identical.
3. **Lossless round trip.** `export → restore → export` yields the same files. This is
   enforced by a test (`tests/export-restore.test.js`).
4. **Storage-agnostic.** Binaries are fetched through our own `/media/<key>` route and
   stored under their content hash, not under a bucket URL.

Deliberately **not** exported: `sessions`, `stats_daily`, and FTS internal tables —
they are transient or derived.

## Commands

```bash
# against a running instance
ADMIN_TOKEN=... API_URL=https://your-domain.com pnpm content:export [dir]
ADMIN_TOKEN=... API_URL=https://your-domain.com pnpm content:verify [dir]
ADMIN_TOKEN=... API_URL=https://your-domain.com pnpm content:restore [dir]
```

`content:export` prunes the target directory first, so the mirror is an exact
snapshot (a safety check refuses to export into the project root or your home
directory). `content:verify` compares the live database with the folder and exits
non-zero on any drift.

## Restoring somewhere else

1. Create a fresh database and apply migrations.
2. Run `content:restore` against it.
3. Point the app at that database.

Nothing in the folder references Cloudflare. If you move to a Node host, only the
D1 adapter in `src/lib/server/db.ts` needs replacing.

## Privacy

The export is a **full** log, including:

- `actors.email_hash` (salted hash of commenter emails)
- `events.payload.ipHash` (salted, per-day hash of commenter IPs)
- comments in `pending`, `spam` or `deleted` state

Treat the export folder as **private data**. Do not publish it to a public
repository. If you want a public mirror, strip those fields or keep the mirror in a
private repository.
