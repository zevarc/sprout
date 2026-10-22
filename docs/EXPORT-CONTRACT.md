# Export contract

This is the promise that makes sprout portable: **everything needed to rebuild the
site can be written to a folder of plain text**, and restored from it. The data
model is in [DATA-MODEL](./DATA-MODEL.md); operational steps in
[DATA-IMPORT-EXPORT](./DATA-IMPORT-EXPORT.md).

The contract below is export format **v4** — what `pnpm content:export` writes and
`pnpm content:restore` reads. Bundles from v3 are converted with
`pnpm content:migrate-v3-to-v4` (DATA-MODEL.md §10).

---

## 1. Layout

```
export/
  schema.json                    # format version + db schema version + tables + kinds
  people.jsonl                   # every human (owner, member, commenter)
  identities.jsonl               # external accounts → person
  assets.jsonl                   # the part of content shared by all kinds
  posts.jsonl                    # one file per declared content kind
  moments.jsonl
  projects.jsonl
  comments.jsonl                 # comments on any asset
  reactions.jsonl                # person × emoji × asset
  tags.jsonl                     # the tag vocabulary
  asset_tags.jsonl               # which asset carries which tag
  media.jsonl                    # stored objects (binaries in media/)
  asset_media.jsonl              # where each object is used
  nodes/<kind>/<slug>.<lang>.md  # human-readable mirror, one per asset
  media/<r2_key>                 # binaries fetched from /media/<key>
```

`schema.json`:

```json
{
  "version": 4,
  "db_schema": "4",
  "generator": "sprout-export",
  "tables": ["people", "identities", "assets", "posts", "moments", "projects",
             "comments", "reactions", "tags", "asset_tags", "media", "asset_media"],
  "types": ["post", "moment", "project"]
}
```

`version` is the **export format**; `db_schema` is `meta.schema_version` in the
database it came from; `types` is the list of content kinds whose files are
present.

---

## 2. Record shapes

### `people.jsonl`

`id`, `role` (`null` | `owner` | `member`), `handle`, `display_name`, `avatar_url`,
`email_hash`, `created_at`, `updated_at`.

### `identities.jsonl`

`provider`, `provider_uid`, `person_id`, `created_at`.

### `assets.jsonl`

`id`, `type`, `lang`, `group_id`, `status` (`draft` | `published` | `archived`),
`visibility` (`public` | `private`), `published_at`, `occurred_at`, `author_id`,
`created_at`, `updated_at`.

### `<kind>.jsonl` — `posts.jsonl`, `moments.jsonl`, `projects.jsonl`, …

The asset id, the human identity and the content of that kind:
`id`, `lang`, `slug`, `title`, `summary`, `body_md`, followed by that kind's own
columns (for `projects`: `year`, `stage`, `website`, `repo_url`, `order_index`).

`body_html` is **not** included — it is derived and recomputed on restore.

### `comments.jsonl`

`id`, `asset_id`, `parent_id`, `author_id`, `body_md`, `status`
(`pending` | `approved` | `spam` | `deleted`), `moderated_at`, `moderated_by`,
`payload` (parsed object), `created_at`.

### `reactions.jsonl`

`asset_id`, `person_id`, `emoji`, `created_at`.

### `tags.jsonl` / `asset_tags.jsonl`

`tags`: `id`, `name`.
`asset_tags`: `asset_id`, `tag_id`.

### `media.jsonl` / `asset_media.jsonl`

`media`: `id`, `r2_key`, `kind`, `sha256`, `created_at`. The binary is at
`media/<r2_key>`; `r2_key` is relative.
`asset_media`: `asset_id`, `media_id`, `position`, `alt`, `role`
(`body` | `cover`).

### Markdown mirror

`nodes/<kind>/<slug>.<lang>.md` has YAML frontmatter (`id`, `type`, `lang`,
`slug`, `group_id`, `title`, `summary`, `status`, `published_at`, `occurred_at`,
`visibility`, `author_id`, `created_at`, `updated_at`, `tags`, plus that kind's
own columns) followed by `body_md`. Restore uses the JSONL; the mirror is for
humans and diffs.

---

## 3. Guarantees

1. **Deterministic.** Rows are sorted by primary key; JSON object keys are sorted;
   timestamps are ISO-8601. Two consecutive exports of an unchanged database are
   byte-identical.
2. **Complete for content.** People, identities, assets, every kind's rows,
   comments, reactions, tags, media metadata and how each object is used are
   included. No rendered HTML is exported; restore re-renders bodies from
   `body_md`.
3. **Lossless round trip.** `export → restore → export` yields the same files
   (enforced by `tests/export-restore.test.js`).
4. **Storage-agnostic.** Binaries are fetched through `/media/<key>` and stored
   under their content hash, not a bucket URL.
5. **Versioned.** Restore refuses a bundle whose `version` is newer than the build
   supports, and refuses an older one with a pointer to the converter.
6. **Kind-tolerant.** The importer restores the kinds listed in `schema.json.types`
   and **skips an unknown kind file with a warning**, so a bundle from a newer
   build does not crash an older one. Adding a content kind is therefore additive
   on both sides.

Deliberately **not** exported: `sessions`, `invites`, `page_views`, `meta`,
`body_html`, and the `*_fts` search tables.

---

## 4. Restore semantics

`restoreFromBundle`:

1. validates `schema.json.version` (an older bundle must be converted first —
   DATA-MODEL.md §10);
2. writes `people`, then `identities`;
3. writes `assets`, then each declared kind's rows;
4. writes `tags` and `asset_tags`;
5. writes `media`, then `asset_media` (the object exists before it is referenced);
6. writes `comments` and `reactions`;
7. re-renders `body_html` from `body_md` and rebuilds each `*_fts` table;
8. the CLI (`pnpm content:restore`) then uploads `media/` binaries with
   `record=0` (metadata is already present);
9. the HTTP endpoint invalidates derived caches afterwards.

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

- `people.email_hash` — salted SHA-256 of commenter emails;
- `comments.payload.ipHash` — salted, per-day IP hash;
- comments in `pending`, `spam` and `deleted` states;
- **private media binaries**.

Treat the export folder as private data. A public mirror must strip these fields,
or stay in a private repository.
