# Implementation

This page maps the code: module responsibilities, request/write lifecycles,
algorithms, security model, and the invariants that keep data accurate.
Architecture principles: [ARCHITECTURE](./ARCHITECTURE.md).

---

## 1. Module map

### Content shape

| File | Responsibility |
|---|---|
| `lib/content/schema.ts` | Dependency-free types: `Label`, `FieldDef`, `FieldOption`, `ContentTypeDef`, `HomeSection`, `Mod`. `fields` is the **declaration** that drives the editor and the write-boundary validation (`lib/engine/fields.ts`) |
| `lib/content/types.ts` | Domain types: `ContentNode`, `NewNode`, `ContentEvent`, `MediaItem`, `NodeVisibility`, `Actor`, … |
| `lib/content/registry.ts` | Type helpers: `getContentType`, `getTypeByRouteSegment`, `listTypes`, `publicTypes`, `privateTypes`, `feedTypes`, `listRouteSegments`, `labelText` |
| `lib/content/view.ts` | `nodeToView()` (readTime, excerpt, TOC, URL, JSON-LD), `listViews`, `listFeaturedViews`, `findRelatedViews`, `nodeToProjectView`, `listProjects`, `translationLinks` (per-locale alternates from `group_id`) |

### Engine

| File | Responsibility |
|---|---|
| `lib/engine/assembly.ts` | Pure `mergeAssembly(base, mods)`; dedupes features; rejects a mod without `id` |
| `lib/engine/registry.ts` | The assembled registry (types, features, home sections, theme, mods, private routes, content defaults, `i18nFragments`) |
| `lib/engine/features.ts` | `hasFeature(id)`, `listFeatures()`, `KNOWN_FEATURES` |
| `lib/engine/validate.ts` | `validateConfig()` / `assertValidConfig()` |
| `lib/engine/theme.ts` | `PRESETS`, `resolveTheme()`, `themeCss()` |
| `hooks.js` | Universal `reroute()` (locale prefix → root tree, matching only) |
| `hooks.server.js` | html lang/dir, private-route guard, security headers, theme injection, noindex |

### Domain services

| File | Responsibility |
|---|---|
| `server/db.ts` | Minimal D1/R2 structural interfaces; `query`, `first`, `run`; `Env` |
| `server/render.ts` | markdown-it (trusted/safe), code fences, heading anchors, lazy images |
| `server/search.ts` | Bigram tokenizer, `buildSearchText`, `toMatchExpression` |
| `server/auth.ts` | Signed cookies, sessions, `hashToken`, `loginOwner`, `issueMemberSession`, `isAdmin`, `isEditor`, GitHub helpers |
| `server/cache.ts` | `derivedPaths`, `invalidateNode`, `invalidateAll` |
| `server/loadNode.ts` | Detail loader: status + visibility + translations (per-locale URLs) + related |
| `lib/feed.ts` | RSS 2.0 builder; channel copy (`feed.label`, `feed.language`) comes from the dictionaries |
| `server/export.ts` | Deterministic export bundle |
| `server/restore.ts` | Restore from a bundle (UPSERT, re-render HTML) |
| `server/rebuild.ts` | Rebuild the derived `body_html` |
| `server/stats.ts` | `recordPageview`, `pageviewStats` |
| `server/mediaAccess.ts` | Media readability (node wins, unattached = private) |
| `server/repositories/nodes.ts` | Node CRUD, listings, featured, tags, group siblings (`listGroupNodes`), search, FTS indexing |
| `server/repositories/events.ts` | Append events, status log, rate-limit counts |
| `server/repositories/actors.ts` | Actors, identities, sessions, owner/member helpers |
| `server/repositories/media.ts` | Media rows |
| `server/repositories/invites.ts` | Invite links |
| `server/id.ts` | ULID |

### Routes

- Generic: `routes/[type]` (list), `routes/[type]/[slug]` (detail).
- Static overrides: `posts`, `posts/[slug]`, `posts/notes/[slug]`, `projects`,
  `projects/[slug]`, `tags`, `tags/[tag]`.
- Fixed pages: `about`, `search`, `timeline`, `admin`, `login`, `invite/[token]`.
- Outputs: `feed.xml`, `og/[slug].svg`, `sitemap.xml`, `media/[...key]`.
- API: see §11.

### Presentation

- `components/content/ContentListPage` (`list`/`cards`/`feed`), `ContentDetail`
  (`compact`), `components/posts/Post` (`article`), `components/home/*`.
- Comments, search, tags, projects, about, PageLogo, LanguageSwitcher, visuals.
- `styles/variables.css` defines the base tokens; components read tokens only.
- `lib/i18n/index.js`: `getDictionary()`, `getLink`, `localeFromPath`, `stripLocale`,
  `homePath`. Base dictionaries are `en`/`zh`; `getDictionary` deep-merges every mod's
  `i18n` fragment (from `registry.i18nFragments`) over them, so a mod can even add a
  locale the site does not ship. The dictionaries also own `feed.label` /
  `feed.language`, used by `lib/feed.ts` for the RSS channel — the engine holds no
  locale tables. Also `formatDate(iso, lang)` / `formatMonth(iso, lang)` (terse
  `YYYY.MM.DD` / `YYYY.MM` by default; a locale's `intl`/`dateFormat` metadata
  overrides them via `Intl`) and `dirFor(lang)` for `<html dir>`.
- `LanguageSwitcher` swaps the locale prefix by default; a detail page passes
  `links` (built from `translationLinks`) so each language links to its own slug and
  languages without a translation are not offered.

---

## 2. Configuration assembly

Pseudocode:

```
base = { contentTypes, features, home, theme }           // from sprout.config
for mod of mods:
  require mod.id
  merge mod.contentTypes into contentTypes
  features += mod.features
  home.sections += mod.home.sections
  merge mod.theme.tokens into tokens
  deep-merge mod.i18n[locale] into i18n[locale]
features = dedupe(features)
registry = { contentTypes, features, home, theme, mods, privateRoutes, content, i18n }
```

Validation (boot):

- type `route` starts with `/`;
- no duplicate type routes;
- every type has a non-empty label;
- `listRenderer ∈ {list, cards, feed}` and `detailRenderer ∈ {article, compact}`
  when present;
- `site.locales` is non-empty; `defaultLocale ∈ locales`;
- no locale code equals a type route segment (`/zh` collision);
- every feature id is known;
- mod ids exist and are unique.

---

## 3. Read lifecycle

```
1. hooks.server.handle
   · bare = stripLocale(pathname)
   · isPrivatePath(bare) → session must be owner/member, else 302 /login?next=
   · lang = localeFromPath(pathname)
   · resolve(...) with transformPageChunk:
       - <html lang> = lang
       - inject theme CSS (or ?theme= preset) into </head>
   · security headers; X-Robots-Tag for /admin and private paths
2. hooks.js reroute (universal)
   · /zh/... → /... for route matching; event.url unchanged
3. +page.server / +server load
   · lang = localeFromPath(event.url.pathname)
   · data via content/view + server/repositories only
4. Components receive view + lang
```

---

## 4. Write lifecycle

```
POST/PATCH /api/nodes
  → isEditor(event, db)                 // owner | member | Bearer ADMIN_TOKEN
  → validate type/slug/status
  → slug conflict → 409
  → createNode / updateNode
      · renderMarkdown(bodyMd) → body_html
      · re-index nodes_fts (bigram)
      · updateNode persists group_id / occurred_at / visibility / author
  → invalidateNode(origin, nodeUrl(node), node.slug)
```

Structural writes (`import`, `restore`, grouping, media mutations) call
`invalidateAll(origin)`.

Endpoints return JSON errors (401/400/404/409/413/415/429) instead of throwing a
`Response` (which SvelteKit would turn into a 500).

---

## 5. Rendering pipeline

- **markdown-it** with `html: true` for authored content and `html: false` for
  comments (`renderMarkdown` / `renderComment`).
- Heading ids use the same `slugify` as `lib/reading.ts`, so TOC anchors match.
- Images get `loading="lazy"` and `decoding="async"`.
- Fenced code becomes `<div class="code-block"><button class="code-copy">…</button>
  <pre class="code-pre" data-lang="…"><code class="language-…">…</code></pre></div>`.
  Languages are normalized through an alias map, and unknown ones become `text`.
  Supported highlights include bash, c/cpp, csharp, cmake, css, diff, go, gradle,
  groovy, ini, java, javascript, json, kotlin, makefile, markdown, objectivec,
  perl, php, python, ruby, rust, scss, sql, swift, typescript, xml, yaml.
- The browser (`lib/highlight.js`) lazy-loads highlight.js; `lib/lightbox.js`
  wires image zoom.
- `rebuildBodyHtml` re-renders `body_html` without touching sources or timestamps.

---

## 6. Search

`tokenize(text)`:

- CJK runs (`\u3040-\u30ff`, `\u3400-\u4dbf`, `\u4e00-\u9fff`, `\uf900-\ufaff`)
  become overlapping **bigrams**; a single CJK character is one token.
- Latin/digit runs are lowercased as one token.

Example: `构建配置` → `构建 建配 配置`; `Hello 构建` → `hello 构建`.

`toMatchExpression(q)` returns `"token1" AND "token2" …` (quotes escaped), or `''`.

`nodes_fts` is FTS5 (`unicode61`) over `(id, title, summary, body)`; it is derived
and rebuilt on import/restore.

---

## 7. Events and comments

Identity resolution for a comment:

1. owner session → that actor;
2. provider credentials in the payload → linked/created visitor actor;
3. signed anonymous cookie → that actor;
4. otherwise a new anonymous actor (name required), then a signed cookie.

Rules:

- Honeypot field `website` must stay empty (silent success if filled).
- Kinds accepted by the public endpoint: `comment`, `reaction`.
- Comment text: required, ≤ 4000 chars.
- Reserved display names (site name, `owner`, `admin`, `administrator`) rejected.
- Rate limit: 8 comments per actor per 10 minutes → 429.
- Spam signals: salted, per-day IP hash stored in `payload.ipHash` (raw IP never
  stored).
- Status: owner → approved; an actor with a previously approved comment →
  approved; otherwise pending.
- Read: HTML is rendered on read; raw HTML is escaped.
- Moderation appends to `event_status`; the newest row wins.

---

## 8. Identity and permissions

Cookies:

| Cookie | Purpose | TTL |
|---|---|---|
| `zc_session` | owner/member session; only its HMAC is stored | 30 days |
| `zc_actor` | signed anonymous actor id | 180 days |
| `zc_oauth_state` | GitHub CSRF state | 10 minutes |
| `zc_oauth_next` | same-origin return path | 10 minutes |

Roles:

| Role | How obtained | Capabilities |
|---|---|---|
| owner | `ADMIN_TOKEN` via `/login`/`/admin` | everything |
| member | single-use invite link `/invite/<token>` | read/write content; not members/export/moderation |
| visitor / anonymous | posting a comment | comment |
| external | GitHub identity, linked to a local actor | comment |

`isEditor` = owner | member | `Bearer ADMIN_TOKEN` (content writes).
`isAdmin` = owner | `Bearer ADMIN_TOKEN` (members, moderation, export).

GitHub OAuth uses `read:user`, verifies `state`, and redirects through
`safeNextPath` (same-origin only). Missing client id/secret → `501`.

---

## 9. Media

Upload (`POST /api/admin/media`, multipart):

- allowed types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`,
  `image/svg+xml`; max 8 MB;
- key is content-addressed: `sha256.<ext>`;
- metadata row may attach to a node; `record=0` stores only the binary (restore).

Serve (`GET /media/<key>`):

- only image/video extensions get their real Content-Type; everything else is
  `application/octet-stream` + `Content-Disposition: attachment`;
- every response sets `X-Content-Type-Options: nosniff` and
  `Content-Security-Policy: default-src 'none'; sandbox`;
- readability follows the owning node; unattached/unknown = private; private
  requests need an editor/Bearer, otherwise **404** (never confirms existence);
- public responses are immutable-cached; private ones are `private, no-store`.

---

## 10. Export, restore and rebuild

Export (`buildExport`):

- selects nodes (including `visibility`, `occurred_at`, `author_actor_id`,
  `group_id`), ad-hoc relations, media metadata, events, event status, actors,
  identities;
- excludes `body_html`; comments have no stored HTML;
- writes `schema.json` with `version` (format, currently `2`) and `db_schema`
  (from `meta`), plus one Markdown mirror per node;
- rows sorted, JSON keys sorted, timestamps ISO-8601 → deterministic.

Restore (`restoreFromBundle`):

- rejects an export whose `version` is newer than the build;
- `actors` → `actor_identities` → `nodes` → `relations` → `media` → `events` →
  `event_status`;
- uses `INSERT … ON CONFLICT DO UPDATE` (never `INSERT OR REPLACE`);
- re-renders `body_html` from `body_md`; rebuilds `nodes_fts`;
- expects an empty database.

Rebuild (`rebuildBodyHtml`): optional node id; idempotent; only rewrites
`body_html`.

---

## 11. API endpoints

| Method + path | Auth | Notes |
|---|---|---|
| `GET /api/nodes?type&lang&status` | editor | owner/member listing |
| `POST /api/nodes` | editor | create; 409 on slug conflict; 400 unknown type |
| `GET/PATCH/DELETE /api/nodes/[id]` | editor | patch: title/summary/body/status/slug/lang/group/publishedAt/occurredAt/visibility/featured/coverMediaId/fields/tags; 400 on invalid fields; 409 on slug conflict |
| `GET /api/search?q&lang` | public | anonymous = public only; editors = all |
| `GET/POST /api/events` | public | comments/reactions |
| `POST /api/events/pageview` | public | no cookies; no-op when analytics off |
| `POST /api/auth/login` | public | token → owner session |
| `POST /api/auth/logout` | public | clears cookies |
| `GET /api/auth/session` | public | role/actor/GitHub availability |
| `GET /api/auth/github` | public | 501 if unconfigured |
| `GET /api/auth/github/callback` | public | state-checked; links identity |
| `GET/POST /api/auth/invite` | public | preview/accept invite |
| `GET /api/admin/export` | admin | export bundle |
| `POST /api/admin/import` | admin | idempotent by `(type, slug, lang)` |
| `POST /api/admin/restore` | admin | restore bundle |
| `POST /api/admin/preview` | admin | render Markdown with the real pipeline |
| `POST /api/admin/rerender` | admin | rebuild `body_html` |
| `GET /api/admin/stats?days` | admin | pageview aggregates |
| `POST/GET/PATCH/DELETE /api/admin/media` | editor | upload/list/update/delete |
| `GET/POST /api/admin/moderate` | admin | moderation queue/append |
| `GET/POST/DELETE /api/admin/link` | admin | group translations/series |
| `GET /api/admin/members` | admin | members + invites |
| `DELETE /api/admin/members/[id]` | admin | remove member + sessions |
| `POST /api/admin/members/invites` | admin | mint single-use link |
| `DELETE /api/admin/members/invites/[id]` | admin | revoke invite |

---

## 12. Cache and derived output

`derivedPaths(nodeUrl?, slug?)` covers, for every locale:

- home, `/feed.xml`, and each type's list route;
- `/sitemap.xml`;
- `/<locale>/og/<slug>.svg` for the given slug.

`invalidateNode` / `invalidateAll` are the only entry points. Content pages are not
cached; feed/sitemap/og carry a short `s-maxage`.

---

## 13. Admin console internals

- It is a client-side app (`+page.ts`: `ssr = false`) backed by the JSON API.
- Tabs: Content, Moderation, Stats, and Members (only when `features` includes
  `members`).
- Content: search, type/language/status filters, selection + bulk publish/archive.
- Editor: Markdown toolbar, unsaved guard, local autosave (per draft id), ⌘/Ctrl+S
  save, ⌘/Ctrl+Enter preview, split preview, editable publish date, occurred time
  and visibility, pre-publish warnings (empty slug, empty summary, missing alt,
  heading level skips, duplicate slug), slug-change confirmation.
- Media panel: alt editing, reorder, delete (removes the R2 object).
- Translation pairing: links two same-type nodes into one `group_id`.
- Fields: the form has bespoke inputs for the built-in types; `fields` in the
  registry is declarative.

---

## 14. Error and status conventions

| Case | Response |
|---|---|
| Unauthorized / expired | `401 {"error":"unauthorized"}` |
| Not found / private | `404` (never reveals private existence) |
| Slug conflict | `409 {"error":"slug already exists"}` |
| Invalid input | `400` |
| Rate limited | `429` |
| Payload too large | `413` |
| Unsupported media type | `415` |
| GitHub not configured | `501` |

---

## 15. Security model

- `zc_session` / `zc_actor` are httpOnly, `SameSite=Lax`, `Secure`; only HMACs of
  session tokens are stored.
- `safeNextPath` rejects anything not a same-origin absolute path (`//evil`,
  `https://…`, backslashes, newlines, oversized values).
- Comments render with `html: false`; media is served with `nosniff` and a
  sandboxing CSP; non-image/video types are forced to download.
- Site-wide headers: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`.
- `/admin` and private paths send `X-Robots-Tag: noindex, nofollow`.
- Private content and media return 404 to anonymous callers.

---

## 16. Performance and limits

- Write-time Markdown only; no server-side highlighter (avoids Worker CPU limits).
- Import is batched (`IMPORT_BATCH`, default 8) so a batch never splits a
  translation group.
- Search uses a single portable FTS index; no runtime segmenter.
- Analytics is aggregated on write; raw page-view events are not stored.
- Export is deterministic; media downloads carry `Bearer ADMIN_TOKEN`.

---

## 17. Tests and guards

| Test | Protects |
|---|---|
| `export-restore.test.js` | byte-identical round trip; new columns/visibility/grouping |
| `data-model.test.js` | ULID identity, rename safety, group translations, no translation edges, derived comment HTML, CHECK constraints |
| `visibility.test.js` | public-by-default listings, search filtering, private detail 404 |
| `architecture.test.js` | no SQL in routes; no colour literals in components |
| `locale.test.js` | `reroute`, `stripLocale`, `getLink`, `homePath` |
| `assembly.test.js` | mod merge, feature dedupe, missing id |
| `config.test.js` | shipped config valid; types routable; features present |
| `registry.test.js` | type lookups, renderer keys, list-route segments |
| `theme.test.js` | presets, override precedence, dark block |
| `auth.test.js` / `render.test.js` / `search.test.js` | cookie signing, escaping, tokenization |

---

## 18. Known boundaries

- Generic list/detail pages cover **single-segment** type routes only.
- No dynamic component registry; bespoke visuals are static routes.
- `?theme=` previews one request; it does not persist.
- `fields` is validated at the write boundary (`lib/engine/fields.ts`); the admin
  editor renders one input per declared field. Unknown keys are rejected, not
  silently dropped.
- Analytics is not part of the content export.
