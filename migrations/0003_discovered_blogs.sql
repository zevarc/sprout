-- Zevprobe blogroll — blogs discovered by the external discovery service
-- (https://github.com/zevarc/zevprobe) and pulled into sprout by
-- `scripts/blogs-sync.mjs` (D1 HTTP API upsert; sprout never grants the
-- discovery service write access — the sync is always pull-shaped).
--
-- `id` is Zevprobe's stable blog id, so repeated syncs upsert in place and the
-- cursor in `sync_state` stays meaningful. `latest_posts` is a JSON array of
-- { url, title, publishedAt } — denormalized on purpose: the blogroll is a
-- read-only showcase, not a queryable archive of other people's writing.

CREATE TABLE discovered_blogs (
  id            INTEGER PRIMARY KEY,
  url           TEXT NOT NULL UNIQUE,
  feed_url      TEXT,
  title         TEXT,
  description   TEXT,
  language      TEXT,
  favicon_url   TEXT,
  last_post_at  TEXT,
  first_seen    TEXT,
  latest_posts  TEXT NOT NULL DEFAULT '[]',
  synced_at     TEXT NOT NULL
);
CREATE INDEX idx_discovered_blogs_last_post ON discovered_blogs(last_post_at DESC);

-- Which blog the discovery service picked on which day (mirrors Zevprobe's
-- `picks`), powering the "today's discovery" highlight.
CREATE TABLE discovered_picks (
  pick_date  TEXT PRIMARY KEY,
  blog_id    INTEGER NOT NULL REFERENCES discovered_blogs(id) ON DELETE CASCADE,
  synced_at  TEXT NOT NULL
);

-- Single-row-per-key sync cursors for the pull script.
CREATE TABLE sync_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
