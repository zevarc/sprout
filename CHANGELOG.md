# Changelog

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
