-- Static pages that accept comments.
--
-- A page is not content: nothing lists it, searches it, feeds it or puts it in
-- the sitemap. It exists so a comment has an asset to hang on — the schema's
-- rule is that everything conversational references `assets.id`. The row is
-- created on the first comment, using a deterministic id (`page:<slug>:<lang>`),
-- so the anchor is stable across restores and needs no admin surface.
CREATE TABLE pages (
  id        TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  lang      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  title     TEXT,
  summary   TEXT,
  body_md   TEXT NOT NULL DEFAULT '',
  body_html TEXT
);
CREATE UNIQUE INDEX idx_pages_lang_slug ON pages (lang, slug);

-- Same shape as the content kinds, so export/restore treat a page like any
-- other kind file (`pages.jsonl`) without a special case.
CREATE VIRTUAL TABLE pages_fts USING fts5 (
  id UNINDEXED,
  lang UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'unicode61'
);
