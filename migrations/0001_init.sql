-- sprout content platform · canonical schema (schema_version = 4, export format 4)
--
-- Design and rationale: docs/DATA-MODEL.md. This file is the schema itself; the
-- document describes it and no longer carries a second copy of the DDL.
--
-- Axioms:
--   · Shared columns live on `assets`: what code must filter or sort by without
--     knowing the content kind (visibility, status, language, times, author).
--     Authorisation therefore never needs to know what kind of content it guards.
--   · Content lives on one table per kind; a new kind is a new table. Title, body,
--     slug and the kind's own attributes are real columns with real constraints.
--   · Comments, tags, media and reactions reference `assets.id` only, so adding a
--     kind never touches them.
--   · Authority lives in exactly one place: people.role. Sessions carry no role.
--   · Closed enums get CHECK; open vocabularies (kind names, media.kind,
--     identities.provider, stage) get none.
--   · Derived columns (body_html, *_fts) are never exported and can be rebuilt.
--   · Deleting a person or an object that is still referenced is refused by the
--     database, so erasure is always an explicit operation.

-- ============ meta ============
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO meta (key, value) VALUES ('schema_version', '4');

-- ============ people: every human ============
-- The owner, invited members and everyone who ever commented. "Not a member" is
-- an empty `role`, not an enum value.
CREATE TABLE people (
  id           TEXT PRIMARY KEY,                          -- opaque ULID
  role         TEXT CHECK (role IN ('owner', 'member')),  -- NULL = not a member
  handle       TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  email_hash   TEXT,                                      -- salted hash, dedupe only
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_people_handle     ON people (handle);
CREATE INDEX idx_people_email_hash ON people (email_hash);
-- At most one owner, enforced by the database.
CREATE UNIQUE INDEX idx_people_one_owner ON people (role) WHERE role = 'owner';

CREATE TABLE identities (
  provider     TEXT NOT NULL,                             -- open: github | email | …
  provider_uid TEXT NOT NULL,
  person_id    TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (provider, provider_uid)
);
CREATE INDEX idx_identities_person ON identities (person_id);

-- Sign-in credential. The hash is the key; no role (authority lives on people).
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,                            -- HMAC of the cookie
  person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_person  ON sessions (person_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- One-shot invite. The only table that is updated: a credential, not history.
CREATE TABLE invites (
  id          TEXT PRIMARY KEY,                           -- safe handle for the admin
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

-- ============ assets: the shared part of every piece of content ============
CREATE TABLE assets (
  id           TEXT PRIMARY KEY,                          -- opaque ULID; the target
  type         TEXT NOT NULL,                             -- open vocabulary
  lang         TEXT NOT NULL,
  group_id     TEXT NOT NULL,                             -- translations / series
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'archived')),
  visibility   TEXT NOT NULL DEFAULT 'public'
                 CHECK (visibility IN ('public', 'private')),
  published_at TEXT,                                      -- feed ordering
  occurred_at  TEXT,                                      -- timeline ordering
  author_id    TEXT NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_assets_kind     ON assets (type, status, published_at DESC);
CREATE INDEX idx_assets_timeline ON assets (visibility, status, occurred_at DESC);
CREATE INDEX idx_assets_group    ON assets (group_id);
CREATE INDEX idx_assets_author   ON assets (author_id, created_at DESC);

-- ============ content: one table per kind ============
-- Each kind table uses the asset id as its primary key and owns its constraints.
-- `lang` is repeated here (see docs/DATA-MODEL.md §6.1) because a SQLite index
-- cannot span a join, and slug uniqueness is per language.

CREATE TABLE posts (
  id        TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  title     TEXT NOT NULL,
  summary   TEXT,
  body_md   TEXT NOT NULL,
  body_html TEXT                                          -- derived, never exported
);
CREATE UNIQUE INDEX idx_posts_lang_slug ON posts (lang, slug);

-- Short notes: the same spine, no required title (a note is often one paragraph).
CREATE TABLE notes (
  id        TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  title     TEXT,
  summary   TEXT,
  body_md   TEXT NOT NULL,
  body_html TEXT
);
CREATE UNIQUE INDEX idx_notes_lang_slug ON notes (lang, slug);

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
  stage       TEXT,                                       -- open: active | maintained | archived
  website     TEXT,
  repo_url    TEXT,
  order_index INTEGER
);
CREATE UNIQUE INDEX idx_projects_lang_slug ON projects (lang, slug);
CREATE INDEX idx_projects_order ON projects (order_index);

-- ============ conversation ============
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
  payload      TEXT,                                      -- never queried
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

-- ============ classification ============
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

-- ============ media: R2 metadata ============
-- One row per stored object, shared by every asset that uses it. Deleting is
-- "unbind, then collect": `asset_media` refuses to let an in-use object go.
CREATE TABLE media (
  id         TEXT PRIMARY KEY,
  r2_key     TEXT NOT NULL UNIQUE,
  kind       TEXT NOT NULL DEFAULT 'image',               -- open vocabulary
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
-- At most one cover per asset.
CREATE UNIQUE INDEX idx_asset_media_cover ON asset_media (asset_id) WHERE role = 'cover';

-- ============ analytics (not exported; daily rows pruned after 400 days) ============
CREATE TABLE page_views (
  day      TEXT NOT NULL,                                 -- YYYY-MM-DD (UTC)
  path     TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',                      -- referrer host only
  views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, referrer)
);

-- ============ search: one derived FTS5 index per kind ============
-- Text is bigram-tokenized before writing (see src/lib/server/search.ts).
CREATE VIRTUAL TABLE posts_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);
CREATE VIRTUAL TABLE moments_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);
CREATE VIRTUAL TABLE notes_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);
CREATE VIRTUAL TABLE projects_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);
