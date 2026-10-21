# Export contract

This is the promise that makes sprout portable: **everything needed to rebuild the
site can be written to a folder of plain text**, and restored from it. The data
model is in [DATA-MODEL](./DATA-MODEL.md); operational steps in
[DATA-IMPORT-EXPORT](./DATA-IMPORT-EXPORT.md).

---

## 1. Layout

```
export/
  schema.json                    # format version + db schema version + table list
  nodes.jsonl                    # one JSON object per node
  node_fields.jsonl              # type-specific attributes (one row per field)
  node_tags.jsonl                # many-to-many tags
  relations.jsonl                # ad-hoc edges only
  media.jsonl                    # media metadata (binaries in media/)
  events.jsonl                   # interactions + structured payload
  event_status.jsonl             # full moderation history
  actors.jsonl
  actor_identities.jsonl
  nodes/<type>/<slug>.<lang>.md  # human-readable mirror, one per node
  media/<sha256>.<ext>           # binaries fetched from /media/<key>
```

`schema.json`:

```json
{
  "version": 3,
  "db_schema": "3",
  "generator": "sprout-export",
  "tables": ["nodes", "node_fields", "node_tags", "relations", "media", "events", "event_status", "actors", "actor_identities"]
}
```

`version` is the **export format**; `db_schema` is `meta.schema_version` in the
database it came from.

---

## 2. Record shapes

### `nodes.jsonl`

`id`, `type`, `slug`, `lang`, `group_id`, `title`, `summary`, `body_md`, `status`,
`published_at`, `occurred_at`, `visibility`, `featured`, `cover_media_id`,
`author_actor_id`, `created_at`, `updated_at`.
`body_html` is **not** included; type-specific data is in `node_fields.jsonl`.

### `node_fields.jsonl`

`{ node_id, field, kind, value }` where `kind ∈ text | number | bool | json`.
Exactly one typed value per `(node_id, field)`; the set of `field` keys is the
site's declaration, validated at the write boundary (restore trusts the bundle).

### `node_tags.jsonl`

`{ node_id, tag }`, sorted by `(node_id, tag)`.

### `relations.jsonl`

`from_id`, `to_id`, `rel`. Only ad-hoc edges; translations/series are derived from
`group_id`, so no translation rows exist.

### `media.jsonl`

`id`, `node_id`, `r2_key`, `kind`, `width`, `height`, `alt`, `position`, `sha256`.
The binary is at `media/<r2_key>`; `r2_key` is relative.

### `events.jsonl`

`id`, `kind`, `target_type`, `target_id`, `actor_id`, `parent_id`, `body_md`,
`payload` (parsed object), `created_at`. `payload` holds structured metadata
(`ipHash`, emoji, …) and never rendered HTML.

### `event_status.jsonl`

`event_id`, `status`, `at`, `by`. Append-only; the newest row is effective.

### `actors.jsonl` / `actor_identities.jsonl`

`actors`: `id`, `kind`, `handle`, `display_name`, `avatar_url`, `email_hash`,
`created_at`.
`actor_identities`: `actor_id`, `provider`, `provider_uid`.

### Markdown mirror

`nodes/<type>/<slug>.<lang>.md` has YAML frontmatter (`id`, `type`, `slug`, `lang`,
`group_id`, `title`, `summary`, `status`, `published_at`, `occurred_at`,
`visibility`, `featured`, `cover_media_id`, `author_actor_id`, `created_at`,
`updated_at`, `tags`, `fields`) followed by `body_md`. Restore uses the JSONL; the
mirror is for humans and diffs.

---

## 3. Guarantees

1. **Deterministic.** Rows are sorted by primary key; JSON object keys are sorted;
   timestamps are ISO-8601. Two consecutive exports of an unchanged database are
   byte-identical.
2. **Complete for content.** Nodes, declared fields, tags, ad-hoc relations, media
   metadata, events, moderation history and actors are included, with `visibility`,
   `occurred_at`, `featured`, `cover_media_id`, `author_actor_id` and `group_id`.
   No rendered HTML is exported; restore re-renders node bodies from `body_md`.
3. **Lossless round trip.** `export → restore → export` yields the same files
   (enforced by `tests/export-restore.test.js`).
4. **Storage-agnostic.** Binaries are fetched through `/media/<key>` and stored
   under their content hash, not a bucket URL.
5. **Versioned.** Restore refuses an export whose `version` is newer than the
   build supports.

Deliberately **not** exported: `sessions`, `stats_daily`, `invites`, and FTS
internal tables.

---

## 4. Restore semantics

`restoreFromBundle`:

1. validates `schema.json.version` (a v2 bundle must be converted with
   `pnpm content:migrate-v2-to-v3` first);
2. writes actors, identities, nodes (cover NULL), fields, tags, media, then points
   covers at their media rows;
3. writes relations, events and `event_status`;
4. re-renders `body_html` and rebuilds `nodes_fts`;
5. the CLI (`pnpm content:restore`) then uploads `media/` binaries with
   `record=0` (metadata is already present);
6. the HTTP endpoint invalidates derived caches afterwards.

Restore expects an **empty** database.

---

## 5. Commands

```bash
# against a running instance
ADMIN_TOKEN=… API_URL=https://your-domain.com pnpm content:export [dir]
ADMIN_TOKEN=… API_URL=https://your-domain.com pnpm content:verify [dir]
ADMIN_TOKEN=… API_URL=https://your-domain.com pnpm content:restore [dir]
```

- `content:export` prunes the target first; it refuses the project root, `/`, and
  the home directory. Media downloads carry `Bearer ADMIN_TOKEN`.
- `content:verify` compares the live export with the folder file-by-file and exits
  non-zero on drift.
- `content:restore` posts the bundle, then re-uploads media.

Full detail: [DATA-IMPORT-EXPORT](./DATA-IMPORT-EXPORT.md).

---

## 6. Privacy

The export is a **full** log:

- `actors.email_hash` — salted SHA-256 of commenter emails;
- `events.payload.ipHash` — salted, per-day IP hash;
- comments in `pending`, `spam` and `deleted` states;
- **private media binaries**.

Treat the export folder as private data. A public mirror must strip these fields,
or stay in a private repository.
