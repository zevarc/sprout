# Data model

The whole schema is [`migrations/0001_init.sql`](../migrations/0001_init.sql).
Timestamps are ISO-8601 UTC strings. IDs are opaque (ULID or a stable logical id) —
never a vendor id.

## `nodes` — everything you author

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | stable across renames; comments reference it |
| `type` | TEXT | `post` / `note` / `moment` / `project` / … |
| `slug` | TEXT | URL segment, unique per `(type, lang)` |
| `lang` | TEXT | `en` / `zh` |
| `group_id` | TEXT | links translations / series together |
| `title`, `summary` | TEXT | nullable (`moment` often has neither) |
| `body_md` | TEXT | the source |
| `body_html` | TEXT | derived cache, re-rendered on restore |
| `status` | TEXT | `draft` / `scheduled` / `published` / `archived` |
| `published_at` | TEXT | feed ordering |
| `created_at`, `updated_at` | TEXT | |
| `extra` | TEXT (JSON) | type-specific fields, validated by the registry |

Indexes: unique `(type, slug, lang)`, feed ordering `(type, status, published_at)`,
`group_id`.

## `relations` — translations, series, related

`(from_id, to_id, rel)` where `rel` is `translation` / `series` / `related` /
`reply-to`. Translations are derived from `group_id` (all members of a group point
at each other).

## `media` — binaries live in R2

`(id, node_id, r2_key, kind, width, height, alt, position, sha256)`.

`r2_key` is **relative** (e.g. `<sha256>.png`). `GET /media/<key>` serves it, so the
storage provider can change without touching any row.

## `events` — everything other people do

| column | notes |
|---|---|
| `kind` | `comment` / `reaction` / `subscribe` / `mention` / `pageview` |
| `target_type`, `target_id` | what it refers to — the content type is opaque here |
| `actor_id` | who (see `actors`) |
| `parent_id` | comment threading |
| `body_md` | comment text |
| `payload` | JSON (rendered HTML, hashed IP, emoji…) |
| `created_at` | |

**Append-only.** No update/delete statements exist for this table.

## `event_status` — moderation as an append-only log

`(event_id, status, at, by)` with `status ∈ pending | approved | spam | deleted`.

The effective status is the **latest row** for that event. Deleting a comment adds a
`deleted` row; the text stays in the log for auditability and lossless export.

## `actors` / `actor_identities` — identity, locally owned

`actors(id, kind, handle, display_name, avatar_url, email_hash, email_enc, created_at)`
where `kind ∈ owner | visitor | anonymous | external`.

`actor_identities(actor_id, provider, provider_uid)` maps an external account (GitHub)
to **your** actor id — so changing identity providers never rewrites history.

`email_hash` is a salted SHA-256; `email_enc` is reserved for reply notifications and
is currently unused. Raw IPs are never stored.

## `sessions` — owner and visitor sessions

`(id, actor_id, token_hash, role, expires_at, created_at)`. Only the HMAC of the
cookie value is stored.

## `stats_daily` — analytics, aggregated on write

`(day, path, referrer, views)`. One row per day/path/referrer-domain. No cookies, no
user ids, no raw IPs. Keeping aggregates (rather than raw page-view events) bounds
row growth and keeps the table portable.

## `nodes_fts` — full-text search

FTS5 virtual table over `(id, title, summary, body)`. Text is bigram-tokenized at
write time so two-character Chinese queries match. Rebuilt on import/restore.

Not exported: `sessions`, `stats_daily`, and the FTS internal tables — they are
transient or derived.
