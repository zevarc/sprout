-- Friends (友情链接) — a curated link list plus the public application queue.
--
-- `friends` is a content kind like `posts`/`projects`: the kind's own table
-- carries the link's real columns, and the shared `assets` row carries status,
-- visibility, language and publish time. That means the generic admin editor,
-- the export contract, tags and the search index all work without new code.
--
-- `friend_applications` is a moderation queue, not content: it holds an
-- applicant's contact email and a salted IP hash. It is deliberately **not**
-- exported (docs/EXPORT-CONTRACT.md), the same way `invites` is not. Approving
-- an application creates a `friends` row and stores its id in `asset_id`, so a
-- published link stays traceable to the request that produced it.

CREATE TABLE friends (
  id          TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,                              -- site name
  summary     TEXT,                                       -- one-line description
  body_md     TEXT NOT NULL DEFAULT '',
  body_html   TEXT,                                       -- derived, never exported
  url         TEXT NOT NULL,                              -- the friend's site
  avatar      TEXT,                                       -- icon / avatar URL
  feed        TEXT,                                       -- RSS / Atom URL
  order_index INTEGER                                     -- curated order, ASC
);
CREATE UNIQUE INDEX idx_friends_lang_slug ON friends (lang, slug);
CREATE INDEX idx_friends_order ON friends (order_index);

-- Derived search index, one per kind (see src/lib/server/search.ts).
CREATE VIRTUAL TABLE friends_fts USING fts5 (
  id UNINDEXED, lang UNINDEXED, title, summary, body, tokenize = 'unicode61'
);

CREATE TABLE friend_applications (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,                             -- site name
  url          TEXT NOT NULL,
  description  TEXT,
  avatar_url   TEXT,
  feed_url     TEXT,
  links_page   TEXT,                                      -- where they linked us back
  email        TEXT,                                      -- contact only, never public
  message      TEXT,
  lang         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  -- Result of the reciprocal-link probe: ok | missing | unreachable | skipped.
  reciprocal   TEXT,
  source_hash  TEXT,                                      -- salted IP hash, rate limiting
  asset_id     TEXT REFERENCES assets(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  reviewed_at  TEXT,
  reviewed_by  TEXT REFERENCES people(id) ON DELETE SET NULL
);
CREATE INDEX idx_friend_applications_status ON friend_applications (status, created_at DESC);
CREATE INDEX idx_friend_applications_hash ON friend_applications (source_hash, created_at DESC);
-- One pending request per site: a duplicate submission is refused by the database.
CREATE UNIQUE INDEX idx_friend_applications_pending ON friend_applications (url)
  WHERE status = 'pending';
