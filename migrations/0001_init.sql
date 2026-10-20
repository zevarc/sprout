-- sprout 内容平台 · 规范 schema（format v2）
--
-- 设计公理：
--   · 节点（授权内容）与事件（他人交互）对称泛化；状态只追加。
--   · 主键是不透明 ULID，永不派生于内容（改 slug / 修正语言都不会断引用）。
--   · group_id 是「同组」（译文 / 系列）的唯一真相源；译文关系由它派生，不落库。
--   · 类型专属字段进 nodes.extra（JSON）；新增类型 / 字段不改表。
--   · 封闭枚举写 CHECK；开放词汇（type / events.kind / relations.rel / actors.kind）不写 CHECK。
--   · 渲染产物（body_html）是派生缓存，永不导出，可重建。
--   · 外键用于声明引用完整性（宿主支持时生效；应用层亦显式删除，行为一致），一律不带隐式动作歧义。

-- ============ 元信息 ============
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO meta (key, value) VALUES ('schema_version', '2');

-- ============ 身份 ============
CREATE TABLE actors (
  id           TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,                 -- 开放：owner | member | visitor | anonymous | external | …
  handle       TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  email_hash   TEXT,
  email_enc    TEXT,                          -- 仅在需要回复通知时存储
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_actors_handle ON actors (handle);

CREATE TABLE actor_identities (
  id           TEXT PRIMARY KEY,
  actor_id     TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,                 -- 开放：github | email | webmention | …
  provider_uid TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (provider, provider_uid)
);
CREATE INDEX idx_actor_identities_actor ON actor_identities (actor_id);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  actor_id   TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'visitor'
               CHECK (role IN ('owner', 'member', 'visitor')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_token ON sessions (token_hash);

CREATE TABLE invites (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL,                  -- 只存 HMAC，不存明文 token
  label       TEXT,
  role        TEXT NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'owner')),
  created_by  TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  accepted_at TEXT,                           -- 单次有效
  accepted_by TEXT REFERENCES actors(id) ON DELETE SET NULL
);
CREATE INDEX idx_invites_token   ON invites (token_hash);
CREATE INDEX idx_invites_created ON invites (created_at DESC);

-- ============ 内容节点（授权资产） ============
CREATE TABLE nodes (
  id              TEXT PRIMARY KEY,           -- 不透明 ULID
  type            TEXT NOT NULL,              -- 开放词汇：post | moment | toy | …
  slug            TEXT NOT NULL,
  lang            TEXT NOT NULL,
  group_id        TEXT NOT NULL,              -- 不透明 ULID；同组=译文/系列；默认=自身 id
  title           TEXT,
  summary         TEXT,
  body_md         TEXT NOT NULL,              -- 源
  body_html       TEXT,                       -- 派生缓存（不导出，可重建）
  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at    TEXT,                       -- 发布时刻（feed 排序）
  occurred_at     TEXT,                       -- 事情发生时刻（时间线排序）
  visibility      TEXT NOT NULL DEFAULT 'public'
                    CHECK (visibility IN ('public', 'private')),
  author_actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  extra           TEXT NOT NULL DEFAULT '{}'  -- 类型专属字段 JSON
);
CREATE UNIQUE INDEX idx_nodes_type_slug_lang ON nodes (type, slug, lang);
CREATE INDEX idx_nodes_feed     ON nodes (type, status, published_at DESC);
CREATE INDEX idx_nodes_timeline ON nodes (visibility, status, occurred_at DESC);
CREATE INDEX idx_nodes_group    ON nodes (group_id);

-- ============ 关系（仅临时边；译文由 group_id 派生） ============
CREATE TABLE relations (
  from_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_id   TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  rel     TEXT NOT NULL,                      -- 开放：related | reply-to | mention | …
  PRIMARY KEY (from_id, to_id, rel)
);
CREATE INDEX idx_relations_to ON relations (to_id, rel);

-- ============ 媒体（二进制在 R2，此处存元数据；可读性随所属节点） ============
CREATE TABLE media (
  id       TEXT PRIMARY KEY,
  node_id  TEXT REFERENCES nodes(id) ON DELETE CASCADE,  -- 可空：未挂载素材
  r2_key   TEXT NOT NULL,                     -- 相对 key，不存绝对 URL
  kind     TEXT NOT NULL DEFAULT 'image',     -- 开放：image | video | file | …
  width    INTEGER,
  height   INTEGER,
  alt      TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  sha256   TEXT
);
CREATE INDEX idx_media_node ON media (node_id, position);
CREATE INDEX idx_media_key  ON media (r2_key);

-- ============ 事件（他人交互，只追加） ============
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,                  -- 开放：comment | reaction | subscribe | mention | pageview | …
  target_type TEXT,                           -- 对内容类型零感知
  target_id   TEXT,
  actor_id    TEXT REFERENCES actors(id) ON DELETE SET NULL,
  parent_id   TEXT REFERENCES events(id) ON DELETE SET NULL,  -- 评论嵌套
  body_md     TEXT,                           -- 源；渲染 HTML 一律派生，不落库
  payload     TEXT,                           -- 仅结构化元数据（ipHash、emoji…），不含渲染产物
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_events_target    ON events (target_type, target_id, created_at DESC);
CREATE INDEX idx_events_kind_time ON events (kind, created_at DESC);
CREATE INDEX idx_events_actor     ON events (actor_id, created_at DESC);

-- 审核 / 编辑 / 删除也是追加，永不 update
CREATE TABLE event_status (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status   TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'spam', 'deleted')),
  at       TEXT NOT NULL,
  by       TEXT REFERENCES actors(id) ON DELETE SET NULL
);
CREATE INDEX idx_event_status_event ON event_status (event_id, at);

-- ============ 分析（自建，隐私优先；运行产物，不导出） ============
CREATE TABLE stats_daily (
  day      TEXT NOT NULL,                     -- YYYY-MM-DD (UTC)
  path     TEXT NOT NULL,
  referrer TEXT NOT NULL DEFAULT '',          -- 仅来源域
  views    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, referrer)
);

-- ============ 统一搜索（派生 FTS5，可重建） ============
-- 写入时对文本做 bigram 预处理（见 src/lib/server/search.ts），列内为空格分隔的 token。
CREATE VIRTUAL TABLE nodes_fts USING fts5 (
  id UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'unicode61'
);
