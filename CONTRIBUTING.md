# Contributing

Thanks for taking a look.

## Before you open a PR

```bash
pnpm install
pnpm check    # type check
pnpm test     # unit tests
pnpm build    # production build
```

All three must pass. CI runs the same commands.

## Project layout

- `src/lib/content/` — content types and the node → view mapping
- `src/lib/server/` — domain logic (render, repositories, auth, export/restore)
- `src/routes/` — pages and `/api` endpoints
- `migrations/` — SQL schema; add a new numbered file for every change
- `tests/` — vitest unit tests

## Ground rules

1. **Keep the domain layer vendor-free.** Cloudflare specifics belong in
   `src/lib/server/db.ts`, `wrangler.toml` and `src/app.d.ts`; everything else is
   plain TypeScript.
2. **Never mutate `events`.** Moderation is append-only.
3. **Determinism matters.** Anything that touches the export format must keep output
   stable (sorted keys, sorted rows), or `content:verify` breaks.
4. **No personal data in the repository.** No tokens, no real content, no media.
5. **Add a test** for new logic in `src/lib/server/*` where practical.

## Commit messages

Conventional commits are appreciated (`feat:`, `fix:`, `docs:`, `refactor:`), but the
content matters more than the prefix.
