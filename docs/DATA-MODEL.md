# Data model

**Target: database schema `4`, export format `4`.** The schema in this repository
is still `3`, so the operational pages — Deploy, Verify, Implementation, Usage —
follow the shipped code until the switch in §10 lands. Design and contract pages
(Architecture, Export contract, Data import/export, Philosophy) follow this page.

---

## 1. Priorities

A schema is only "optimal" relative to a set of priorities. These are the ones
this design is measured against.

| # | Priority | Where it shows up |
|---|---|---|
| P1 | **Portable** — the export *is* the site | every persistent thing is plain text; one file per table; no vendor ids, no blobs |
| P2 | **Cheap to add things** | a new content kind is a new table; a new shared capability is one column on `assets` |
| P3 | **Let the database hold the rules** | unique keys, foreign keys, closed enums, "at most one owner", "at most one cover" |
| P4 | **Personal scale** (10³–10⁴ items) | reads may join; no read models, no partitioning, no caches to invalidate |
| P5 | **Data model only** | this page says nothing about pages, routes, themes or search UI |

What this design does **not** optimise for, and what breaks first if that changes:

| If this becomes true | What breaks first | Direction |
|---|---|---|
| 10⁶ items | one join per read; export loads everything into memory | read models per list; streamed export |
| one database holds several sites | there is no site dimension anywhere | add a site column to the shared tables |
| editing history becomes a requirement | current-state rows overwrite silently | add `asset_revisions` (§4.14) |
| offline / multi-device editing | last-write-wins loses updates | append-only change log instead of state rows |

---

## 2. Design rules

1. **Ids are opaque ULIDs.** Nothing is derived from content, so renaming a slug,
   fixing a language, or moving an item between kinds never breaks a reference.
2. **A column that code must filter or sort by *without knowing the content kind*
   lives on `assets`**: visibility, status, language, the two timestamps, author.
   Access control must never need to know whether it is a post or a moment.
3. **A column only needed when reading one item lives on its own type table**:
   slug, title, summary, body, and whatever that kind is made of.
4. **Everything that is not content references `assets.id`** — comments, tags,
   media, reactions. Never a type table.
5. **Adding a content kind adds a table; adding a shared capability touches one
   table.** Neither drags the other along.
6. **Rules the database can hold are written into the database** — unique keys,
   foreign keys, closed enums, and the two partial unique indexes in §4.5/§4.10.
7. **Authority has exactly one home**: `people.role`. Sessions carry no role.
8. **Derived data may be stored but must be recomputable, and is never exported.**
9. **Append-only by default.** An exception must have a stated reason (§6).
10. **No abstraction for a requirement that does not exist yet** — no tenant
    column, no global key/value column table, no `relations` table until
    something actually writes to it.
11. **The export is deterministic and round-trips byte-identically** (the existing
    test already asserts this; it stays the contract).

---

## 3. Structure at a glance

```
people ──< identities                 external accounts → person
   │  ──< sessions                    sign-in credentials (no role)
   │  ──< invites                     one-shot invite links
   │
   ├──< assets.author_id              who recorded it   (NOT NULL)
   ├──< comments.author_id            who said it       (NOT NULL)
   └──< reactions.person_id           who reacted

assets ─1:1─ posts | moments | projects     exactly one type row per asset
   ├──< comments.asset_id
   ├──< reactions.asset_id
   ├──< asset_tags >── tags
   └──< asset_media >── media
```

| Table | Role | Exported |
|---|---|---|
| `people` | every human: owner, member, commenter | yes |
| `identities` | external account → person | yes |
| `sessions` | sign-in credential | no |
| `invites` | one-shot invite link | no |
| `assets` | the part of content that is shared by all kinds | yes |
| `posts` `moments` `projects` (…) | the content itself, one table per kind | yes |
| `comments` | comments (any kind of asset) | yes |
| `reactions` | one row per person × emoji × asset | yes |
| `tags`, `asset_tags` | vocabulary and its usage | yes |
| `media`, `asset_media` | R2 object metadata and where it is used | yes |
| `page_views` | analytics, aggregated | no |
| `meta` | schema revision | no |
| `posts_fts` `moments_fts` `projects_fts` | derived search index, one per kind | no |
| `asset_revisions` | *optional* — see §4.14 | yes, if used |

---

## 4. Tables

### 4.1 `people` — every human

One table for the site owner, invited members, and everyone who ever commented.
There is no separate "user" concept and no `kind` column: *not being a member* is
expressed by an empty `role`, not by an enum value.

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | opaque ULID |
| `role` | TEXT | `NULL` = not a member; `CHECK ∈ owner \| member` when set |
| `handle` | TEXT | account name (GitHub login, member label) |
| `display_name` | TEXT | shown on content and comments |
| `avatar_url` | TEXT | |
| `email_hash` | TEXT | salted hash, **de-duplication only**; cleared when the person is erased |
| `created_at` `updated_at` | TEXT NOT NULL | |

Constraints and indexes:

- `role` carries authority. **This is why sessions do not store a role**: revoking
  a member is one value change and takes effect everywhere immediately.
- Partial unique index → the database refuses a second owner.
- Index on `handle` and `email_hash` (lookup).

### 4.2 `identities` — external accounts

| Column | Type | Notes |
|---|---|---|
| `provider` | TEXT NOT NULL | open vocabulary: `github`, `email`, … |
| `provider_uid` | TEXT NOT NULL | id on the provider side |
| `person_id` | TEXT NOT NULL | FK → `people(id)` ON DELETE CASCADE |
| `created_at` | TEXT NOT NULL | |

`PRIMARY KEY (provider, provider_uid)` — the natural key; no surrogate id.
Changing provider never rewrites history.

### 4.3 `sessions` — sign-in credential

| Column | Type | Notes |
|---|---|---|
| `token_hash` | TEXT PK | HMAC of the cookie value; the raw token is never stored |
| `person_id` | TEXT NOT NULL | FK → `people(id)` ON DELETE CASCADE |
| `expires_at` | TEXT NOT NULL | |
| `created_at` | TEXT NOT NULL | |

No `role` (rule 7), no decorative `id` (the hash *is* the key). Index on
`person_id` ("sign this person out everywhere") and on `expires_at` (pruning).

### 4.4 `invites` — one-shot links

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | the only handle that is safe to hand to the admin UI |
| `token_hash` | TEXT NOT NULL UNIQUE | HMAC of the token |
| `label` | TEXT | display name for the new member |
| `role` | TEXT NOT NULL DEFAULT `member` | `CHECK ∈ member \| owner` |
| `created_by` `accepted_by` | TEXT | FK → `people(id)` ON DELETE SET NULL |
| `created_at` `expires_at` `accepted_at` | TEXT | `accepted_at` is single-use |

This is the one table that is updated rather than appended to — see §6.
The surrogate `id` is kept **because** the admin needs a handle it can show;
exposing a token hash as an identifier is a bad habit even when the token is
random.

### 4.5 `assets` — the shared part of every piece of content

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | opaque ULID; the target of every comment/tag/media/reaction |
| `type` | TEXT NOT NULL | open vocabulary; which type table holds the detail |
| `lang` | TEXT NOT NULL | the cross-kind language filter |
| `group_id` | TEXT NOT NULL | same group = translations / series; defaults to the row's own id |
| `status` | TEXT NOT NULL DEFAULT `draft` | `CHECK ∈ draft \| published \| archived` |
| `visibility` | TEXT NOT NULL DEFAULT `public` | `CHECK ∈ public \| private` |
| `published_at` | TEXT | feed ordering |
| `occurred_at` | TEXT | when it happened; timeline ordering |
| `author_id` | TEXT NOT NULL | FK → `people(id)` ON DELETE RESTRICT |
| `created_at` `updated_at` | TEXT NOT NULL | |

Decisions worth naming:

- **No `scheduled`.** There is no scheduler anywhere in the system; an enum value
  that can never become true is a lie. Adding it back later is one `CHECK` change
  — which, in SQLite, means rebuilding the table, so it waits until it is real.
- **`author_id` is NOT NULL.** Every piece of content has an author; a
  single-author site assigns the owner. This removes a null branch from every
  read and makes attribution always present.
- **`ON DELETE RESTRICT`.** Deleting a person cannot silently strip authorship
  from their content — erasure is an explicit operation (§5.3).
- Indexes: `(type, status, published_at DESC)`, `(visibility, status, occurred_at DESC)`,
  `(group_id)`, `(author_id, created_at DESC)`.
  Note that `type` lives here, so "tags/labels per content kind" stays a single
  query without touching the type tables.

### 4.6 One table per content kind

Every type table has the same spine, uses the asset id as its primary key, and
owns its own constraints:

| Column | Notes |
|---|---|
| `id` | PK, FK → `assets(id)` ON DELETE CASCADE |
| `lang` | copied from the asset — see §6.1 |
| `slug` | `UNIQUE (lang, slug)` within this table |
| `title` `summary` | as the kind requires (nullable where it makes no sense) |
| `body_md` | the source text |
| `body_html` | derived cache, never exported |
| … | this kind's own columns, with real `NOT NULL` / `CHECK` |

The site ships three:

- `posts` — `title NOT NULL`, `summary`, `body_md`, `body_html`
- `moments` — `body_md`, `body_html`, `title`/`summary` nullable (a moment is
  usually text plus media)
- `projects` — `title NOT NULL`, `summary`, `body_md`, `body_html`, `year`,
  `stage` (active / maintained / archived — deliberately *not* named `status`, to
  avoid confusion with the asset's publication status), `website`, `repo_url`,
  `order_index`

Adding a fourth kind later is: one `CREATE TABLE` + its FTS table + a line in the
exporter. No existing table is touched.

### 4.7 `comments`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | ULID |
| `asset_id` | TEXT NOT NULL | FK → `assets(id)` ON DELETE CASCADE |
| `parent_id` | TEXT | FK → `comments(id)` ON DELETE CASCADE (threading) |
| `author_id` | TEXT NOT NULL | FK → `people(id)` ON DELETE RESTRICT |
| `body_md` | TEXT NOT NULL | source; HTML is rendered on read |
| `status` | TEXT NOT NULL DEFAULT `pending` | `CHECK ∈ pending \| approved \| spam \| deleted` |
| `moderated_at` `moderated_by` | TEXT | who decided, when |
| `payload` | TEXT | JSON metadata that is never queried (`ipHash`, …) |
| `created_at` | TEXT NOT NULL | |

- **One status column, not a status log.** The v3 append-only log made every read
  take the newest row, and the "newest wins" logic was implemented incorrectly in
  two places. A single column is simpler and removes that whole class of bug. If
  a moderation history is ever wanted, add `comment_status_log`; reads are
  unaffected.
- `ON DELETE RESTRICT` on the author, same reason as assets: erasing a person is
  an explicit operation, never a cascade.
- Indexes: `(asset_id, status, created_at)`, `(author_id, created_at DESC)`.

### 4.8 `reactions`

| Column | Type | Notes |
|---|---|---|
| `asset_id` | TEXT NOT NULL | FK → `assets(id)` ON DELETE CASCADE |
| `person_id` | TEXT NOT NULL | FK → `people(id)` ON DELETE CASCADE |
| `emoji` | TEXT NOT NULL | |
| `created_at` | TEXT NOT NULL | |

`PRIMARY KEY (asset_id, person_id, emoji)` → "one of each emoji per person per
asset" is a database rule, not a code rule. Reactions cascade with the person
(they are ephemeral state); comments do not (§5.3 explains the difference).

### 4.9 `tags` and `asset_tags`

| `tags` | | |
|---|---|---|
| `id` | TEXT PK | ULID |
| `name` | TEXT NOT NULL UNIQUE | |

| `asset_tags` | | |
|---|---|---|
| `asset_id` | TEXT NOT NULL | FK → `assets(id)` ON DELETE CASCADE |
| `tag_id` | TEXT NOT NULL | FK → `tags(id)` ON DELETE CASCADE |

`PRIMARY KEY (asset_id, tag_id)`, index `(tag_id)`.

A vocabulary table (rather than a text column) means renaming a tag is one
`UPDATE`, and per-kind counts are one `GROUP BY` over `assets.type`.

### 4.10 `media` and `asset_media`

| `media` | | |
|---|---|---|
| `id` | TEXT PK | ULID |
| `r2_key` | TEXT NOT NULL UNIQUE | content-addressed: **one row per stored object** |
| `kind` | TEXT NOT NULL DEFAULT `image` | open vocabulary |
| `sha256` | TEXT | content hash |
| `created_at` | TEXT NOT NULL | |

| `asset_media` | | |
|---|---|---|
| `asset_id` | TEXT NOT NULL | FK → `assets(id)` ON DELETE CASCADE |
| `media_id` | TEXT NOT NULL | FK → `media(id)` ON DELETE RESTRICT |
| `position` | INTEGER NOT NULL DEFAULT 0 | ordering **within this asset** |
| `alt` | TEXT | alternative text **for this usage** |
| `role` | TEXT NOT NULL DEFAULT `body` | `CHECK ∈ body \| cover` |

- `PRIMARY KEY (asset_id, media_id)`; index `(media_id)`.
- Partial unique index → an asset has at most one `role = 'cover'` row. This is
  where "the cover" belongs: it is a statement about *this asset's use* of a
  file, not about the file.
- `UNIQUE (r2_key)` + the association table is what makes sharing honest: the
  same object used by two assets is **one** `media` row and **two**
  `asset_media` rows. Alt text and ordering are per use; the object is shared.
- **Deleting a file is "unbind, then collect":** delete the `asset_media` row
  first — `ON DELETE RESTRICT` refuses to delete a `media` row while any
  association points at it. This removes the v3 bug where deleting one
  attachment deleted the binary another asset was still using.
- No `width` / `height` columns in the base design: v3 had them and nothing ever
  wrote a value. When the upload path actually measures images, add the two
  columns.

### 4.11 `page_views`

| Column | Type | Notes |
|---|---|---|
| `day` | TEXT NOT NULL | `YYYY-MM-DD` (UTC) |
| `path` | TEXT NOT NULL | |
| `referrer` | TEXT NOT NULL DEFAULT `''` | referrer host only |
| `views` | INTEGER NOT NULL DEFAULT 0 | |

`PRIMARY KEY (day, path, referrer)`. No cookies, no ids, no raw IPs. Not
exported. A retention window should be decided (§12).

### 4.12 Search tables — one per content kind

```
posts_fts    (id UNINDEXED, lang UNINDEXED, title, summary, body)   fts5, tokenize = unicode61
moments_fts  (id UNINDEXED, lang UNINDEXED, title, body)
projects_fts (id UNINDEXED, lang UNINDEXED, title, summary, body)
```

Search is per kind, so each kind gets its own index and can index different
columns. They are derived, never exported, and rebuilt on import/restore.
`lang` is carried as an `UNINDEXED` column so a query filters by language without
a join.

### 4.13 `meta`

`key` / `value`, with `schema_version = 4`. Nothing else belongs here.

### 4.14 `asset_revisions` — optional, only if editing history is wanted

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | ULID |
| `asset_id` | TEXT NOT NULL | FK → `assets(id)` ON DELETE CASCADE |
| `at` | TEXT NOT NULL | |
| `by_id` | TEXT | FK → `people(id)` ON DELETE SET NULL |
| `snapshot` | TEXT NOT NULL | JSON of the previous values |

Do **not** build this speculatively. It costs storage proportional to edits and
nothing else in the design depends on it; adding it later touches no existing
table.

---

## 5. How identity and content connect

**5.1 One person table serves both content and conversation.** A post's author
and a comment's author are the same kind of row. There is no separate "commenter"
concept, so comments need exactly one authorish foreign key and attribution is
consistent everywhere.

**5.2 Authority is one column, and it is type-agnostic.** "May this person edit
content?" is answered by `people.role` — not by a session, not by the content
kind. Revoking a member is `role = NULL` plus deleting their credentials, and it
takes effect immediately.

**5.3 Revoking is not erasing.**

- *Revoke a member*: clear `role`, delete `sessions` and `identities`, clear
  `email_hash`. The person row stays, so the content and comments they wrote keep
  their attribution.
- *Erase a person* (a privacy request): reassign their content and comments to a
  standing "anonymous" person row, then delete the row. The foreign keys are
  `RESTRICT`, so this cannot happen by accident — the database refuses to delete
  a person who still has content.
- *Why reactions cascade but comments do not*: a reaction is ephemeral state with
  no audit value; a comment is part of the record.

**5.4 Anonymous commenters are ordinary people** with an empty `role`, recognised
by a signed cookie. No extra table, no second author type.

**5.5 An invite is a person's precursor**: accepting one creates or reuses a
`people` row, sets `role`, and records an `identities` row; `invites.accepted_by`
points at the resulting person.

---

## 6. Deliberate exceptions and duplications

Each of these is a conscious choice, not an oversight.

**6.1 `lang` exists on `assets` *and* on each type table.** `assets.lang` is
needed for cross-kind filtering (rule 2); the type table needs it to enforce
`UNIQUE (lang, slug)` locally (rule 3), because a SQLite index cannot span a
join. The invariant "both are equal" is enforced by having a single write path
and by a test; language changes go through one function.

**6.2 `invites` is the only table that is updated.** An invite is a credential,
not content history: making it append-only would add a table and a join and buy
nothing. It still gets a `UNIQUE` token hash.

**6.3 `invites` keeps a surrogate `id`.** It is the one handle that is safe to
surface in the admin API; showing a token hash as an identifier is a habit worth
avoiding.

**6.4 `body_html` is stored.** It is derived, which rule 8 allows: it must be
rebuildable and is never exported. The alternative (render on every read) trades
storage for CPU on the hot path.

---

## 7. Rejected alternatives

| Rejected | Why |
|---|---|
| One generic `nodes` table + a key/value `node_fields` table (v3) | type-specific values lose their constraints and are queried indirectly; the key/value table is the reason "price" is a row instead of a column |
| Pure enumeration, no shared table | every access check, export ordering and "authored by" query becomes a union over N tables; authority stops being one place |
| Comments/tags/media with nullable foreign keys per kind (`post_id`, `moment_id`, …) | every new content kind forces an `ALTER` on all of them — it destroys the main benefit of enumeration |
| Title/body on the shared table | that is v3 with extra steps: per-kind constraints are lost again |
| A single global search table | search is per kind, so per-kind tables are simpler and can index different columns |
| Keeping a generic `events` table with a `kind` column | with comments and reactions as real tables, the generic table only hid the structure; its unimplemented kinds (`subscribe`, `mention`, `pageview`) were never written |
| A `relations` table | nothing wrote to it once translations moved to `group_id` and replies to `parent_id`; re-add it when a real relation needs storing |
| A separate `memberships` table | pays off only with several sites per database or with a role audit trail; a column plus a partial unique index is simpler *and* can enforce "at most one owner" |

---

## 8. Accepted costs

- **Reads join.** One item = `assets` + its type table (+ associations). At
  personal scale this is irrelevant, and it buys type-specific constraints.
- **Cross-kind listings union.** "Everything, newest first" must combine tables.
  If this turns out to be frequent, adding `title` to `assets` is a single
  `ALTER`; it is deliberately not done up front.
- **The shared/type boundary is a standing rule.** New columns must be placed by
  rule 2/3 and reviewed; this is the only place where discipline is required
  continuously.
- **`lang` is stored twice per item** (§6.1).
- **The export grows one file per content kind.**

---

## 9. Export contract

One file per table, all text:

```
schema.json          { version: 4, db_schema: "4", tables: [...], types: ["post","moment","project"] }
people.jsonl  identities.jsonl
assets.jsonl
posts.jsonl   moments.jsonl   projects.jsonl     (one per declared kind)
comments.jsonl  reactions.jsonl
tags.jsonl   asset_tags.jsonl
media.jsonl  asset_media.jsonl
nodes/<kind>/<slug>.<lang>.md                    human-readable mirror
media/<r2_key>                                   binaries
```

Rules:

1. **Deterministic**: rows sorted by primary key, JSON object keys sorted, ISO-8601
   timestamps. `export → restore → export` is byte-identical (existing test).
   Full detail in [EXPORT-CONTRACT](./EXPORT-CONTRACT.md).
2. **Not exported**: `sessions`, `invites`, `page_views`, `meta`, `*_fts`,
   `body_html` (recomputed on restore).
3. **Kind-aware restore**: the importer reads `schema.json.types` and restores
   exactly those kind files. **An unknown kind file is skipped with a warning**,
   so a bundle produced by a newer build does not crash an older one — this is
   what makes "add a kind later" safe for migration.
4. **Version gate**: a bundle whose `version` is newer than the build supports is
   refused; an older one is refused with a pointer to the converter (§10).
5. Restore expects an empty database; all writes for one row group happen in one
   transaction.

---

## 10. Migration v3 → v4

Following the pattern the project already uses (`migrate-v2-to-v3.mjs`): the
conversion works on an **export bundle**, not on a live database, and the new
database is filled by a normal restore. That keeps the risky part ("reshaping
while it is running") out of the process, and it is the same drudgery either way.

| v3 | v4 |
|---|---|
| `nodes` (all columns) | `assets` (id, type, lang, group_id, status, visibility, published_at, occurred_at, author_id, created_at, updated_at) |
| `nodes.title/summary/slug/body_md/body_html` | the row's type table, chosen by `nodes.type` |
| `nodes.featured`, `nodes.cover_media_id` | dropped; a cover is `asset_media.role = 'cover'` |
| `node_fields` rows | columns on the matching type table (reviewed per field); anything that is never queried stays out rather than becoming a key/value row |
| `node_tags` | `tags` (deduplicated by name) + `asset_tags` |
| `media.node_id` | `asset_media` (one row per attachment) |
| `events.kind = 'comment'` | `comments` (status from the latest `event_status` row) |
| `events.kind = 'reaction'` | `reactions` (`payload.emoji`) |
| other `events` kinds | none exist in practice; anything unexpected is reported, not silently dropped |
| `actors` | `people` (`kind` → `role`: `owner`/`member` become roles, everything else becomes `NULL`; `email_enc` dropped) |
| `actor_identities` | `identities` (dropped surrogate id) |
| `sessions` | `sessions` (role dropped; re-login) |
| `invites` | `invites` (unchanged in shape) |
| `stats_daily` | `page_views` |
| `nodes_fts` | per-kind `*_fts` tables |
| `relations` | dropped |

Then: `pnpm content:restore <v4-dir>` into a fresh database, run the invariant
tests (§11), and re-export to confirm byte-identical output.

Because sessions are not exported, everyone signs in again — acceptable, and it
is the reason the drop of `sessions.role` costs nothing operationally.

---

## 11. Invariants (to be enforced by tests)

1. Every `assets` row has exactly one type row, and its table matches `type`.
2. `type_table.lang = assets.lang` for every row (§6.1).
3. At most one `people.role = 'owner'` row (also enforced by the index).
4. `comments.author_id` and `assets.author_id` are never null.
5. No `media` row is deleted while `asset_media` references it; deleting an
   association leaves the object until nothing references it.
6. At most one `role = 'cover'` row per asset.
7. `status = 'published'` implies `published_at` is set (application rule, tested
   — not a `CHECK`, because changing a `CHECK` in SQLite rebuilds the table).
8. Public reads never return a private asset, and never return media that is only
   used by private assets — see §12 for the exact rule.
9. `export → restore → export` is byte-identical.
10. No table outside this document exists (a test asserts the schema matches).

---

## 12. Open decisions

1. **Media visibility rule (needed before implementing).** A shared object can be
   used by both public and private assets. Two rules:
   - *any reference public → public*: no broken images, but a picture used in a
     private draft becomes publicly readable;
   - *all references public → public*: nothing leaks, but sharing a file between
     a private and a public asset requires storing a second copy.
   Recommendation: **all references public**, because a leak is worse than a
   missing image, and the copy is cheap because keys are content-addressed.
2. **Editing history** — include `asset_revisions` (§4.14) or not.
3. **`page_views` retention** — how long before rows are aggregated away.
4. **Erase procedure** — confirm §5.3 (reassign to a standing anonymous person,
   then delete).
5. **`projects.stage` vocabulary** — the allowed list for active / maintained /
   archived.
6. **Soft delete / recycle bin** — v4 has no `deleted_at`; deleting is real.
   Adding it later means every read filters on it.

---

## Appendix A — full DDL

```sql
-- ============================================================
-- sprout · data model (schema_version = 4, export format 4)
--
-- Rules: see docs/DATA-MODEL.md §2.
--   · shared columns live on `assets`; content lives on one table per kind;
--   · comments / tags / media / reactions reference `assets.id` only;
--   · closed enums get CHECK; open vocabularies get none;
--   · derived columns (body_html, *_fts) are never exported;
--   · authority lives only in people.role.
-- ============================================================

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO meta (key, value) VALUES ('schema_version', '4');

-- ---------- people ----------
CREATE TABLE people (
  id           TEXT PRIMARY KEY,
  role         TEXT CHECK (role IN ('owner', 'member')),   -- NULL = not a member
  handle       TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  email_hash   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_people_handle     ON people (handle);
CREATE INDEX idx_people_email_hash ON people (email_hash);
CREATE UNIQUE INDEX idx_people_one_owner ON people (role) WHERE role = 'owner';

CREATE TABLE identities (
  provider     TEXT NOT NULL,
  provider_uid TEXT NOT NULL,
  person_id    TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (provider, provider_uid)
);
CREATE INDEX idx_identities_person ON identities (person_id);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_person  ON sessions (person_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

CREATE TABLE invites (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  label       TEXT,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'owner')),
  created_by  TEXT REFERENCES people(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  accepted_at TEXT,
  accepted_by TEXT REFERENCES people(id) ON DELETE SET NULL
);
CREATE INDEX idx_invites_created ON invites (created_at DESC);

-- ---------- content: the shared part ----------
CREATE TABLE assets (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  lang         TEXT NOT NULL,
  group_id     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'archived')),
  visibility   TEXT NOT NULL DEFAULT 'public'
                 CHECK (visibility IN ('public', 'private')),
  published_at TEXT,
  occurred_at  TEXT,
  author_id    TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_assets_kind     ON assets (type, status, published_at DESC);
CREATE INDEX idx_assets_timeline ON assets (visibility, status, occurred_at DESC);
CREATE INDEX idx_assets_group    ON assets (group_id);
CREATE INDEX idx_assets_author   ON assets (author_id, created_at DESC);

-- ---------- content: one table per kind ----------
CREATE TABLE posts (
  id        TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  title     TEXT NOT NULL,
  summary   TEXT,
  body_md   TEXT NOT NULL,
  body_html TEXT
);
CREATE UNIQUE INDEX idx_posts_lang_slug ON posts (lang, slug);

CREATE TABLE moments (
  id        TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  title     TEXT,
  summary   TEXT,
  body_md   TEXT NOT NULL,
  body_html TEXT
);
CREATE UNIQUE INDEX idx_moments_lang_slug ON moments (lang, slug);

CREATE TABLE projects (
  id          TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT,
  body_md     TEXT NOT NULL,
  body_html   TEXT,
  year        TEXT,
  stage       TEXT,                 -- active | maintained | archived (open)
  website     TEXT,
  repo_url    TEXT,
  order_index INTEGER
);
CREATE UNIQUE INDEX idx_projects_lang_slug ON projects (lang, slug);
CREATE INDEX idx_projects_order ON projects (order_index);

-- ---------- conversation ----------
CREATE TABLE comments (
  id           TEXT PRIMARY KEY,
  asset_id     TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_id    TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  body_md      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'spam', 'deleted')),
  moderated_at TEXT,
  moderated_by TEXT REFERENCES people(id) ON DELETE SET NULL,
  payload      TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_comments_asset  ON comments (asset_id, status, created_at);
CREATE INDEX idx_comments_author ON comments (author_id, created_at DESC);

CREATE TABLE reactions (
  asset_id   TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, person_id, emoji)
);

-- ---------- classification ----------
CREATE TABLE tags (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE asset_tags (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (asset_id, tag_id)
);
CREATE INDEX idx_asset_tags_tag ON asset_tags (tag_id);

-- ---------- media ----------
CREATE TABLE media (
  id         TEXT PRIMARY KEY,
  r2_key     TEXT NOT NULL UNIQUE,
  kind       TEXT NOT NULL DEFAULT 'image',
  sha256     TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE asset_media (
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  alt      TEXT,
  role     TEXT NOT NULL DEFAULT 'body' CHECK (role IN ('body', 'cover')),
  PRIMARY KEY (asset_id, media_id)
);
CREATE INDEX idx_asset_media_media ON asset_media (media_id);
CREATE UNIQUE INDEX idx_asset_media_cover ON asset_media (asset_id) WHERE role = 'cover';

-- ---------- analytics (not exported) ----------
CREATE TABLE page_views (
  day      TEXT NOT NULL,
  path     TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',
  views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, referrer)
);

-- ---------- search (derived, not exported) ----------
CREATE VIRTUAL TABLE posts_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);
CREATE VIRTUAL TABLE moments_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, body, tokenize = 'unicode61'
);
CREATE VIRTUAL TABLE projects_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);

-- ---------- optional (§4.14) ----------
-- CREATE TABLE asset_revisions (
--   id       TEXT PRIMARY KEY,
--   asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
--   at       TEXT NOT NULL,
--   by_id    TEXT REFERENCES people(id) ON DELETE SET NULL,
--   snapshot TEXT NOT NULL
-- );
-- CREATE INDEX idx_asset_revisions_asset ON asset_revisions (asset_id, at DESC);
```
