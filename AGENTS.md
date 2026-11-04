# AGENTS.md — sprout

Cloudflare 原生的「数据可携带」个人内容平台：SvelteKit + Cloudflare Workers + D1 (SQLite) + R2。
站点 = 配置装配出来的：身份在 `src/site.config.js`，装配在 `src/sprout.config.js`。

## 命令

包管理器：**pnpm**（CI 用 pnpm 10 / Node 22）。本地测试依赖 `node:sqlite`，需 Node ≥ 22.5。

```bash
pnpm install
pnpm dev            # vite dev；改了/删了路由文件后改用 pnpm dev:clean（清缓存，避免 stale module graph 导致 500）
pnpm check          # svelte-check：必须 0 errors 0 warnings
pnpm test           # vitest run（含 architecture guards）
pnpm build          # adapter-cloudflare 构建
pnpm db:migrate:local  # wrangler d1 migrations apply DB --local
pnpm db:console:local -- "SELECT …"
```

其它脚本：`content:export|restore|import|verify`、`blogs:sync`、`notify:indexnow`、
`check:links` / `check:sitemap`（都需要一个正在运行的站点，`BASE_URL=…`）。

没有 ESLint/Prettier；格式跟着现有文件走（**tab 缩进**、单引号、`.ts` 文件里行尾分号）。

## 目录

| 路径 | 职责 |
|---|---|
| `src/site.config.js` | 「我是谁」：name/url/author/locales/brand |
| `src/sprout.config.js` | 「我由什么构成」：contentTypes、features、home、theme、mods、privateRoutes、content |
| `src/lib/engine/` | 装配合并、registry、feature gate、启动期校验、主题 |
| `src/lib/content/` | 共享 schema 类型、领域类型、类型 helper、node → view |
| `src/lib/server/` | 领域逻辑：db、render、search、auth、cache、export/restore、rebuild、stats、mediaAccess、`repositories/` |
| `src/lib/components/` | 通用 UI（只有视图 + 主题 token） |
| `src/routes/` | 页面、通用 `[type]` 路由、`api/**`、media、sitemap、feed、og |
| `migrations/` | 按编号追加的 SQL（`0001_init.sql` 是基线，禁止改形状） |
| `tests/` | vitest 单测 + 两条架构守卫 |

## 必须遵守的硬规则

1. **分层单向**：data → architecture → presentation。新能力只能「加」：`assets` 的一列、
   kind 自己的表、或一张新表。**永不修改已发布表的形状**，改动一律是新编号 migration。
2. **路由里不许出现 SQL**（`tests/architecture.test.js` 扫描 `.prepare(` / `query(` / `run(` / `first(`）。
   读写走 `src/lib/server/**` + `src/lib/content/view`。
3. **组件里不许有颜色字面量**（`#rgb` / `rgba(`，同样被守卫扫描）。样式只用主题 token
   （`var(--color-*)`），换风格不改组件。
4. **派生数据不是权威**：`body_html`、`<kind>_fts` 都从源数据重算；重建入口只有
   `src/lib/server/rebuild.ts`（`/api/admin/rerender`）。导出里不含 HTML。
5. **确定性**：任何影响导出的改动必须保持输出稳定（键排序、行排序、ISO-8601），否则
   `content:verify` 会失败。改导出格式要 bump `EXPORT_SCHEMA_VERSION` 并更新
   `docs/EXPORT-CONTRACT.md`。
6. **可见性只在领域层判定**：`listViews` 默认 `visibility='public'`；私有详情 404；
   `/api/search` 对匿名只给 public；`/media` 走 `mediaAccess`（未挂载 = 私有）。
7. **厂商耦合只允许三处**：`wrangler*.toml`、`src/app.d.ts`、`src/lib/server/db.ts`。
   其余是纯 TypeScript，测试用 `tests/helpers/d1-memory.js`（node:sqlite 模拟 D1）。
8. **不要提交个人数据**：`.dev.vars*`、`export/`、真实内容与媒体都在 git 之外。

## 常见改动怎么做

- **加内容类型**：只在 `src/sprout.config.js` 的 `contentTypes` 里声明。单段路由
  （`/links`）自动获得通用列表/详情页和 sitemap 收录，不需要 migration、不需要新路由文件；
  多段路由才需要自己的静态路由。启动期校验会拒绝未知 renderer 键与路由冲突。
- **加语言**：`site.locales` + `src/lib/i18n/<code>.js`（键与 `en.js` 对齐）+ 在
  `src/lib/i18n/index.js` 注册。**不需要路由文件**：`src/hooks.js` 的 `reroute` 只在匹配时
  剥掉非默认语言前缀，`url.pathname` 保留真实路径，所以 loader 用
  `localeFromPath(event.url.pathname)`，链接用 `getLink(path, lang)` / `homePath(lang)`。
  翻译靠 `assets.group_id` 分组，各语言可以有不同 slug。
- **加 mod**：mod 是数据不是组件（贡献 contentTypes/features/home.sections/theme.tokens/i18n），
  注册到 `mods`；mod 不能注入路由。定制页面 = 静态路由覆盖（SvelteKit 静态段优先于 `[type]`）。
- **加迁移**：新建 `migrations/000N_*.sql`；`tests/helpers/d1-memory.js` 会按文件名顺序自动全跑一遍。
- **加 server 逻辑**：在 `src/lib/server/*` 里加测试（可用 `createTestDb()`），
  需要「有真实字段的 kind」时用 `tests/helpers/kinds.js`（不要硬编码模板里的 `project`）。

## 改完要跑的验证

```bash
pnpm check && pnpm test && pnpm build
```

三者全绿才算完（CI 跑的就是这三条）。新增行为尽量补测试。

## 文档即改动的一部分

| 改了什么 | 同步更新 |
|---|---|
| 类型 / renderer / feature / 主题预设 | `docs/USAGE.md`、`README.md` |
| schema 或导出格式 | `docs/DATA-MODEL.md`、`docs/EXPORT-CONTRACT.md`、`CHANGELOG.md` |
| 部署 / 脚本 | `docs/DEPLOY.md`、`docs/DATA-IMPORT-EXPORT.md` |
| 行为或不变式 | `docs/ARCHITECTURE.md`、`docs/IMPLEMENTATION.md`、`docs/VERIFY.md` |

先读 `docs/ARCHITECTURE.md`（分层、路由与 locale 机制、renderer、数据流）再动手。
提交信息用 `feat:` / `fix:` / `docs:` / `refactor:` / `chore:` 前缀，主题 ≤72 字符。
未经明确要求不要 commit，绝不 force push。
