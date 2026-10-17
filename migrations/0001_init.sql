-- Zevarc 内容平台 · 初始 schema
-- 原则：节点（个人资产）与事件（他人交互）对称泛化；状态只追加；核心字段成列，类型专属进 extra。

-- ============ 元信息 ============
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ============ 内容节点（个人资产） ============
CREATE TABLE nodes (
  id           TEXT PRIMARY KEY,              -- 稳定逻辑 ID：'post:avd-on-macos'
  type         TEXT NOT NULL,                 -- post | note | moment | project | ...
  slug         TEXT NOT NULL,
  lang         TEXT NOT NULL DEFAULT 'en',
  group_id     TEXT,                          -- 翻译 / 系列归组
  title        TEXT,
  summary      TEXT,
  body_md      TEXT NOT NULL,                 -- 源
  body_html    TEXT,                          -- 写时渲染产物（可重建）
  status       TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | published | archived
  published_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  extra        TEXT                           -- 类型专属字段 JSON，校验在 registry
);

CREATE UNIQUE INDEX idx_nodes_type_slug_lang ON nodes (type, slug, lang);
CREATE INDEX idx_nodes_feed ON nodes (type, status, published_at DESC);
CREATE INDEX idx_nodes_group ON nodes (group_id);

-- ============ 关系（翻译 / 系列 / 推荐） ============
CREATE TABLE relations (
  from_id TEXT NOT NULL,
  to_id   TEXT NOT NULL,
  rel     TEXT NOT NULL,                      -- translation | series | related | reply-to
  PRIMARY KEY (from_id, to_id, rel)
);
CREATE INDEX idx_relations_to ON relations (to_id, rel);

-- ============ 媒体（二进制在 R2，此处存元数据） ============
CREATE TABLE media (
  id       TEXT PRIMARY KEY,
  node_id  TEXT,                              -- 可空：未挂载的素材
  r2_key   TEXT NOT NULL,                     -- 相对 key，不存绝对 URL
  kind     TEXT NOT NULL DEFAULT 'image',
  width    INTEGER,
  height   INTEGER,
  alt      TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  sha256   TEXT
);
CREATE INDEX idx_media_node ON media (node_id, position);

-- ============ 事件（他人交互，只追加） ============
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                  -- comment | reaction | subscribe | mention | pageview
  target_type TEXT,                           -- 对内容类型零感知
  target_id   TEXT,
  actor_id    TEXT,
  parent_id   TEXT,                           -- 评论嵌套
  body_md     TEXT,
  payload     TEXT,                           -- JSON
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_events_target ON events (target_type, target_id, created_at DESC);
CREATE INDEX idx_events_kind_time ON events (kind, created_at DESC);
CREATE INDEX idx_events_actor ON events (actor_id, created_at DESC);

-- 审核 / 编辑 / 删除也是追加，永不 update
CREATE TABLE event_status (
  event_id TEXT NOT NULL,
  status   TEXT NOT NULL,                     -- pending | approved | spam | deleted
  at       TEXT NOT NULL,
  by       TEXT
);
CREATE INDEX idx_event_status_event ON event_status (event_id, at);

-- ============ 身份 ============
CREATE TABLE actors (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,                 -- owner | visitor | anonymous | external
  handle       TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  email_hash   TEXT,
  email_enc    TEXT,                          -- 仅在需要回复通知时存储（加密）
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_actors_handle ON actors (handle);

CREATE TABLE actor_identities (
  id           TEXT PRIMARY KEY,
  actor_id     TEXT NOT NULL,
  provider     TEXT NOT NULL,                 -- github | email | webmention
  provider_uid TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (provider, provider_uid)
);
CREATE INDEX idx_actor_identities_actor ON actor_identities (actor_id);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'visitor', -- owner | visitor
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_token ON sessions (token_hash);

-- ============ 分析（自建，隐私优先） ============
CREATE TABLE stats_daily (
  day      TEXT NOT NULL,                     -- YYYY-MM-DD (UTC)
  path     TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',          -- 仅来源域
  views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, referrer)
);

-- ============ 统一搜索 ============
-- 写入时对文本做 bigram 预处理（见 src/lib/server/search.ts），列内为空格分隔的 token。
-- unicode61 对空格分隔的 CJK 二元组与拉丁词均可正常索引，规避 trigram 的 3 字符下限。
CREATE VIRTUAL TABLE nodes_fts USING fts5 (
  id UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'unicode61'
);
