# Contributing

Thanks for taking a look. This page covers the workflow, the layout, and the
conventions that keep the data model and the architecture stable.

---

## 1. Before you open a PR

```bash
pnpm install
pnpm check    # svelte-check: 0 errors, 0 warnings
pnpm test     # vitest: all tests pass
pnpm build    # adapter-cloudflare build
```

All three must pass. CI (`.github/workflows/ci.yml`) runs the same commands on
push and pull requests.

---

## 2. Project layout

| Path | Responsibility |
|---|---|
| `src/site.config.js` | Identity: name, url, author, contact, locales, brand |
| `src/sprout.config.js` | Assembly: content types, features, home, theme, mods, private routes, content defaults |
| `src/lib/engine/` | Assembly merge, registry, feature gate, boot validation, theme |
| `src/lib/content/` | Shared schema types, domain types, type helpers, node → view mapping |
| `src/lib/server/` | Domain logic: db adapter, render, search, auth, repositories, cache, export/restore, rebuild, stats, media access |
| `src/lib/components/` | Generic UI (views + theme tokens only) |
| `src/routes/` | Pages, `[type]` generic routes, API endpoints, media, sitemap |
| `migrations/` | SQL schema (single canonical `0001_init.sql`) |
| `tests/` | Vitest unit tests and architecture guards |

---

## 3. Ground rules

1. **Keep the domain layer vendor-free.** Cloudflare specifics belong in
   `src/lib/server/db.ts`, `wrangler*.toml` and `src/app.d.ts`; everything else is
   plain TypeScript.
2. **Never mutate `events`.** Moderation is append-only (`event_status`).
3. **Determinism matters.** Anything touching the export format must keep output
   stable (sorted keys, sorted rows, ISO-8601), or `content:verify` breaks.
4. **No personal data in the repository.** No tokens, no real content, no media.
   `.dev.vars*` and `export/` stay out of git.
5. **Add a test** for new logic in `src/lib/server/*` where practical.
6. **Data → architecture → presentation, one way only.** New capabilities ride on
   `nodes.extra`, `events` or `relations`; do not reshape the core tables to make
   an architecture or UI idea fit.
7. **Two guards must stay green** (`tests/architecture.test.js`):
   - routes never issue SQL (`db.prepare` / `query` / `run` / `first`);
   - components contain no hex/rgba colour literals.
   Route reads/writes go through `src/lib/server/**` + `src/lib/content/view`;
   styles use theme tokens.

---

## 4. Changing the schema

- `migrations/0001_init.sql` is the canonical baseline. **Never edit a shipped
  table's shape.**
- Every change after that is a **new numbered migration**.
- Keep the data model closed under extension: prefer `extra` / `events` /
  `relations`; add a new table only for a genuinely new concept.
- If you change the export format, bump `EXPORT_SCHEMA_VERSION` and update
  [EXPORT-CONTRACT](./docs/EXPORT-CONTRACT.md).
- Run the round-trip test: `pnpm test` includes export → restore → export.

Adding a field or a type should **not** require a migration.

---

## 5. Adding a content type

Edit `src/sprout.config.js`:

```js
link: {
  type: 'link',
  route: '/links',              // single segment → generic list/detail pages
  label: { en: 'Links', zh: '链接' },
  public: true,
  feed: false,
  comments: false,
  listRenderer: 'cards',        // list | cards | feed
  detailRenderer: 'compact',    // article | compact
  fields: [{ key: 'url', label: { en: 'URL', zh: '链接' }, type: 'url', required: true }]
}
```

- No migration and no route files for a single-segment route.
- A multi-segment route needs its own static routes.
- Boot validation rejects unknown renderer keys and collisions.

## 6. Adding a language

1. Add `{ code, label }` to `site.locales`.
2. Add `src/lib/i18n/<code>.js` with the same keys as `en.js` (including
   `feed: { label, language }`).
3. Register it in `src/lib/i18n/index.js` (`baseDictionaries`).
4. Optionally add `brand.<code>`.

No route files are needed: `src/hooks.js` strips non-default locale prefixes for
matching, and `event.url` keeps the real path. Translated content is grouped by
`group_id`, so each language page may use its own slug — the detail pages derive
`hreflang` and the switcher from that group.

## 7. Adding a mod

A mod is data, not components:

```js
export default {
  id: 'my-mod',
  contentTypes: { … },
  features: ['members'],
  home: { sections: [ … ] },
  theme: { tokens: { '--color-bud': '#…' } },
  i18n: { en: { … }, zh: { … } }
};
```

Register it in `sprout.config.js` → `mods`. Mods cannot inject route files; a
bespoke page is a static route override.

## 8. Overriding a type's markup

Create a static route (`src/routes/<route>/+page.svelte` and
`+page.server.ts`). SvelteKit ranks it above `[type]`. Keep all reads/writes in
the domain layer (the guard enforces this).

---

## 9. What to update with a change

| Change | Also update |
|---|---|
| A new type / renderer / feature / theme preset | `docs/USAGE.md`, `README.md` |
| A schema or export change | `docs/DATA-MODEL.md`, `docs/EXPORT-CONTRACT.md`, `CHANGELOG.md` |
| Deployment / scripts | `docs/DEPLOY.md`, `docs/DATA-IMPORT-EXPORT.md` |
| Behavior or invariants | `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION.md`, `docs/VERIFY.md` |

Documentation is part of the change, not an afterthought.

---

## 10. PR checklist

- [ ] `pnpm check` — 0 errors, 0 warnings
- [ ] `pnpm test` — all green (including the architecture guards)
- [ ] `pnpm build` — succeeds
- [ ] No secrets, personal data, or exported content committed
- [ ] New behavior has a test where practical
- [ ] Docs updated (see §9)

---

## 11. Commit messages

Conventional prefixes are appreciated (`feat:`, `fix:`, `docs:`, `refactor:`,
`chore:`), but the content matters more than the prefix. Keep the subject under
~72 characters and explain *why* in the body when it is not obvious.
