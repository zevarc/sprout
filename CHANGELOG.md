# Changelog

## 0.3.0

Tags, and a proper authoring pass on the admin editor.

**Tags**
- `/tags` and `/tags/[tag]` (plus the `/zh/…` pair): every tag gets an archive
  page; tags are matched exactly against `extra.tags` through `json_each`
- post tags are links; archive pages emit `CollectionPage` and are in the sitemap
- the archive is reachable from the footer and from the posts page (not only
  through a tag on an article)

**Admin editor**
- unsaved-changes guard and local autosave (restore or discard), ⌘/Ctrl+S to save,
  ⌘/Ctrl+Enter to preview
- list search plus type/language/status filters, and bulk publish/archive
- Markdown toolbar; uploaded images are inserted at the cursor as
  `![alt](/media/…)`, with the alt stored on the media row
- split preview that refreshes as you type
- pre-publish checks (missing alt, heading level skips, empty summary, duplicate
  slug) — warnings you can override, not blockers
- editable publish date, and a confirmation when a published slug changes
- media panel: edit alt, reorder, delete (the R2 object goes with it)
- translation pairing: link a node to its counterpart in the other language
- `extra` is now written per content type instead of always

**API**
- `PATCH /api/nodes/[id]` accepts `lang` and `publishedAt` (both were silently dropped)
- new `/api/admin/link` (GET/POST/DELETE) and GET/PATCH/DELETE on `/api/admin/media`

## 0.2.0

Hardening, discovery and performance pass — plus the fixes that came out of
running the platform on a real site.

**Security**
- `/media` no longer passes R2's stored `Content-Type` straight through: only
  image/video extensions are served with their real type, everything else is
  forced to `application/octet-stream` + `Content-Disposition: attachment`, and
  every response carries `nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`
  (an uploaded/restored `.html` or `.svg` can no longer execute on your origin)
- site-wide security headers: `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`; `/admin` also sends `X-Robots-Tag: noindex`

**Discovery**
- homepage emits `WebSite` + `Person` structured data (with `SearchAction`)
- search pages accept `?q=` — searches are linkable, and the `SearchAction` works
- headings on list pages no longer skip a level (h1 → h2)

**Performance**
- fonts are self-hosted: Latin/Latin-ext variable woff2 (six files, ~300 KB)
  replaces the render-blocking Google Fonts stylesheet and its preconnects
- Markdown images get `loading="lazy" decoding="async"`
- new `POST /api/admin/rerender` rebuilds the derived `body_html` column from
  `body_md` (needed after a renderer change; touches nothing else)

**Fixes**
- comment avatars were being hit by the article-body `img` rule (40 px margins
  turned a 28 px avatar row into 108 px); body-only rules are now scoped
- GitHub login is reachable from the comment form, returns you to the page you
  came from, and signing out clears the linked identity
- in-page anchors are no longer hidden under the fixed header
- icon-only external links have accessible names and a 24×24 target
- `prefers-reduced-motion` now actually disables the animations (the token
  override it relied on was consumed by nothing)
- removed ~55 unused design tokens and de-duplicated the page-header, card and
  pill styles into shared classes

## 0.1.0

First public release — the platform extracted from a personal site.

**Content**
- one typed content model (`post`, `note`, `moment`, `project`) driven by a registry
- write-time Markdown rendering; heading ids match the TOC extractor
- browser-side syntax highlighting (highlight.js), so publishing never hits Worker
  CPU/memory limits and every language works

**Interactions**
- append-only event log; comments are type-agnostic (`target_type` + `target_id`)
- anonymous-first identity with signed cookies, optional GitHub OAuth
- moderation queue, rate limiting, honeypot, XSS-safe comment rendering

**Discovery**
- SQLite FTS5 search with bigram tokenization (CJK-friendly)
- dynamic RSS, sitemap and OG images derived from the database
- cookie-free, self-hosted page-view analytics

**Operator experience**
- `/admin`: editor, live preview, media upload, moderation, stats
- `pnpm bootstrap`: one-command Cloudflare setup (D1 + R2 + secrets + migrations)
- Vue-free, framework-thin layering: vendor coupling limited to one adapter

**Portability**
- deterministic `export → restore → verify` loop, including media binaries
- standard SQLite schema; relative media keys; no vendor ids as primary keys
- unit tests run against an in-memory `node:sqlite` database
