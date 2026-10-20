# Data model

The whole schema is one file: [`migrations/0001_init.sql`](../migrations/0001_init.sql).
`meta.schema_version` records the revision (currently `2`). Timestamps are
ISO-8601 UTC strings.

Two rules shape everything:

- **Ids are opaque.** Every node/event/actor/media id is a generated ULID, never
  derived from content. `slug`, `lang` and `type` can change without breaking a
  reference.
- **Closed enums get `CHECK`; open vocabularies do not.** `status`, `visibility`
  and `sessions.role` are constrained. `type`, `events.kind`, `relations.rel` and
  `actors.kind` are meant to grow, so they carry no `CHECK` — new kinds need no
  migration.

Migrations are additive after the canonical `0001`: add a new numbered file; never
edit a shipped table's shape.

---

## `meta`

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | e.g. `schema_version` |
| `value` | TEXT NOT NULL | `schema_version` is `2` |

## `actors` — local identity

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | ULID |
| `kind` | TEXT NOT NULL | **open**: `owner` / `member` / `visitor` / `anonymous` / `external` / … |
| `handle` | TEXT | optional handle (GitHub login, `member-<invite>`) |
| `display_name` | TEXT | shown in comments/timeline |
| `avatar_url` | TEXT | optional |
| `email_hash` | TEXT | salted SHA-256 (dedupe only) |
| `email_enc` | TEXT | reserved for reply notifications; unused |
| `created_at` | TEXT NOT NULL | |

Index: `(handle)`.

## `actor_identities` — external accounts → local actor

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `actor_id` | TEXT NOT NULL | FK → `actors(id)` ON DELETE CASCADE |
| `provider` | TEXT NOT NULL | **open**: `github` / `email` / `webmention` / … |
| `provider_uid` | TEXT NOT NULL | provider-side id |
| `created_at` | TEXT NOT NULL | |

`UNIQUE(provider, provider_uid)`; index `(actor_id)`. Changing providers never
rewrites history.

## `sessions` — signed-in owner/member

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `actor_id` | TEXT NOT NULL | FK → `actors(id)` ON DELETE CASCADE |
| `token_hash` | TEXT NOT NULL | HMAC of the cookie value |
| `role` | TEXT NOT NULL DEFAULT `visitor` | `CHECK ∈ owner \| member \| visitor` |
| `expires_at` | TEXT NOT NULL | |
| `created_at` | TEXT NOT NULL | |

Index: `(token_hash)`. The raw cookie value is never stored.

## `invites` — single-use links

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `token_hash` | TEXT NOT NULL | HMAC of the token |
| `label` | TEXT | display name for the new member |
| `role` | TEXT NOT NULL DEFAULT `member` | `CHECK ∈ member \| owner` |
| `created_by` | TEXT | FK → `actors(id)` ON DELETE SET NULL |
| `created_at` | TEXT NOT NULL | |
| `expires_at` | TEXT NOT NULL | |
| `accepted_at` | TEXT | set once used |
| `accepted_by` | TEXT | FK → `actors(id)` ON DELETE SET NULL |

Indexes: `(token_hash)`, `(created_at DESC)`.

## `nodes` — authored content

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | opaque ULID |
| `type` | TEXT NOT NULL | open vocabulary |
| `slug` | TEXT NOT NULL | URL segment |
| `lang` | TEXT NOT NULL | locale code |
| `group_id` | TEXT NOT NULL | opaque ULID; translations/series. The application assigns it at create time (the node's own id when unset); there is no DB-side default |
| `title` | TEXT | nullable |
| `summary` | TEXT | nullable |
| `body_md` | TEXT NOT NULL | source |
| `body_html` | TEXT | **derived cache** — never exported |
| `status` | TEXT NOT NULL DEFAULT `draft` | `CHECK ∈ draft \| scheduled \| published \| archived` |
| `published_at` | TEXT | feed ordering |
| `occurred_at` | TEXT | when it happened; timeline ordering |
| `visibility` | TEXT NOT NULL DEFAULT `public` | `CHECK ∈ public \| private` |
| `author_actor_id` | TEXT | FK → `actors(id)` ON DELETE SET NULL |
| `created_at` | TEXT NOT NULL | |
| `updated_at` | TEXT NOT NULL | |
| `extra` | TEXT NOT NULL DEFAULT `{}` | type-specific JSON |

Constraints/indexes:

- `UNIQUE(type, slug, lang)` — the human identity;
- `(type, status, published_at DESC)` — feed ordering;
- `(visibility, status, occurred_at DESC)` — timeline;
- `(group_id)` — translations/series.

Semantics:

- **Grouping.** Same `group_id` + different `lang` = translations; same `group_id`
  + same `lang` = series. There is no translation edge table.
- **Visibility.** `private` nodes are invisible to anonymous readers; public
  listings and search default to `public`; a private detail page returns 404.
- **Derived.** `body_html` is rebuilt on restore and via `/api/admin/rerender`.
- **`extra`.** Declared by the type registry but not schema-enforced; arbitrary
  JSON is allowed.

## `relations` — ad-hoc edges

| Column | Type | Notes |
|---|---|---|
| `from_id` | TEXT NOT NULL | FK → `nodes(id)` ON DELETE CASCADE |
| `to_id` | TEXT NOT NULL | FK → `nodes(id)` ON DELETE CASCADE |
| `rel` | TEXT NOT NULL | **open**: `related` / `reply-to` / `mention` / … |

`PRIMARY KEY(from_id, to_id, rel)`; index `(to_id, rel)`. **No `translation`** —
that concept lives in `group_id`.

## `media` — R2 metadata

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `node_id` | TEXT | FK → `nodes(id)` ON DELETE CASCADE; nullable (unattached) |
| `r2_key` | TEXT NOT NULL | relative key, e.g. `<sha256>.png` |
| `kind` | TEXT NOT NULL DEFAULT `image` | open: `image` / `video` / `file` / … |
| `width`, `height` | INTEGER | optional |
| `alt` | TEXT | |
| `position` | INTEGER NOT NULL DEFAULT `0` | ordering |
| `sha256` | TEXT | content hash |

Indexes: `(node_id, position)`, `(r2_key)`.

Readability is the owning node's visibility; unresolved/unknown keys are private.
There is no per-media visibility column.

## `events` — interactions (append-only)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `kind` | TEXT NOT NULL | open: `comment` / `reaction` / `subscribe` / `mention` / `pageview` / … |
| `target_type` | TEXT | content type is opaque here |
| `target_id` | TEXT | usually a node id |
| `actor_id` | TEXT | FK → `actors(id)` ON DELETE SET NULL |
| `parent_id` | TEXT | FK → `events(id)` ON DELETE SET NULL (threading) |
| `body_md` | TEXT | source text (comments) |
| `payload` | TEXT | JSON metadata (`ipHash`, emoji, …); **no rendered HTML** |
| `created_at` | TEXT NOT NULL | |

Indexes: `(target_type, target_id, created_at DESC)`, `(kind, created_at DESC)`,
`(actor_id, created_at DESC)`.

There are no UPDATE/DELETE statements for this table.

## `event_status` — moderation log (append-only)

| Column | Type | Notes |
|---|---|---|
| `event_id` | TEXT NOT NULL | FK → `events(id)` ON DELETE CASCADE |
| `status` | TEXT NOT NULL | `CHECK ∈ pending \| approved \| spam \| deleted` |
| `at` | TEXT NOT NULL | |
| `by` | TEXT | FK → `actors(id)` ON DELETE SET NULL |

Index: `(event_id, at)`. The **latest row** is the effective status. Deletion is a
new `deleted` row; the text stays in the log.

## `stats_daily` — analytics (derived, not exported)

| Column | Type | Notes |
|---|---|---|
| `day` | TEXT NOT NULL | `YYYY-MM-DD` (UTC) |
| `path` | TEXT NOT NULL | |
| `referrer` | TEXT NOT NULL DEFAULT `''` | referrer host only |
| `views` | INTEGER NOT NULL DEFAULT `0` | |

`PRIMARY KEY(day, path, referrer)`. No cookies, no user ids, no raw IPs.

## `nodes_fts` — full-text search (derived)

FTS5 virtual table over `(id UNINDEXED, title, summary, body)` with
`tokenize = 'unicode61'`. CJK text is bigram-tokenized at write time. Rebuilt on
import/restore.

---

## Invariants

1. `nodes.id` is opaque; `(type, slug, lang)` is the human key.
2. `nodes.group_id` is never null and is the only translation/series grouping.
3. `relations` never contains translation rows.
4. `nodes.body_html` is derived; the export never includes HTML.
5. `media` readability follows its node; unattached media is private.
6. `events` and `event_status` are append-only.
7. `visibility` and `status` are the only closed node enums; everything else that
   is meant to grow is open.
8. Foreign keys are declared for reference integrity; the in-memory test database
   enables them, and the application also deletes children explicitly.

## Not exported

`sessions`, `stats_daily`, `invites`, and FTS internal tables — transient or
derived. Everything else round-trips through the export contract.
