# Optional: GitHub login for commenters

Comments work **without** logging in: a visitor enters a display name and receives
a signed cookie as their identity.

GitHub login is an **upgrade**: it remembers who they are and shows their GitHub
name/avatar on comments. When unconfigured, the login endpoint returns `501` and
the comment form hides the button.

---

## 1. Create a GitHub OAuth App

GitHub's REST API cannot create OAuth apps; use the web UI:

1. Open <https://github.com/settings/applications/new>.
2. Fill in:

| Field | Value |
|---|---|
| Application name | anything (e.g. `my-site`) |
| Homepage URL | `https://your-domain` |
| Authorization callback URL | `https://your-domain/api/auth/github/callback` |

3. Register, note the **Client ID**, then generate a **Client secret** (shown once).

> The callback URL must match exactly: `https`, no trailing slash, otherwise GitHub
> reports `redirect_uri_mismatch`.

---

## 2. Store the secrets

Production Worker:

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```

Local development (`.dev.vars`, gitignored):

```
GITHUB_CLIENT_ID=xxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxx
```

Worker secrets take effect immediately; local `.dev.vars` changes need a dev-server
restart.

Demo Worker (separate secrets):

```bash
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config wrangler.demo.toml
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.demo.toml
```

The repository's demo domain is `https://sprout.zevarc.com`
(see `wrangler.demo.toml`); its OAuth app needs that callback URL.

---

## 3. Verify

```bash
# 1) configuration is recognised (githubLogin should be true)
curl -s https://your-domain/api/auth/session
# expected: {"role":"visitor","isOwner":false,"githubLogin":true,"actor":null}

# 2) starting the flow redirects to GitHub (302)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  https://your-domain/api/auth/github
# expected: 302 https://github.com/login/oauth/authorize?client_id=…&redirect_uri=…&state=…

# 3) a forged state is rejected (CSRF protection)
curl -s -o /dev/null -w '%{http_code}\n' \
  'https://your-domain/api/auth/github/callback?code=x&state=y'
# expected: 400
```

Browser flow: open an article → click “Sign in with GitHub” → authorize → you
return to the **same article** → the form shows “Commenting as <name> · Sign out”.

---

## 4. Design and security

| Decision | Why |
|---|---|
| Login is optional; anonymous first | lowest possible barrier to comment |
| Identity stored in local `actors`; GitHub token is **not** stored | GitHub is only an identity source; switching providers keeps history |
| `state` is a random token in an httpOnly cookie, checked on callback | CSRF protection |
| `?next=` accepts only same-origin absolute paths | prevents open redirects (`//evil`, `https://…`, backslashes, newlines, oversized values) |
| Return path lives in a 10-minute httpOnly cookie | no business data in `state`; defaults to `/` |
| Provider id maps to a local actor (`actor_identities`) | changing providers never rewrites existing comments |

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Start redirects, but callback/session still show `githubLogin:false` / `501` | only one secret set, or a non-ASCII character snuck into the name | re-set both; check names below |
| GitHub reports `redirect_uri_mismatch` | callback URL differs | must be exactly `https://your-domain/api/auth/github/callback` |
| Returns to the homepage, not the article | start link lacked `?next=` | use the button in the comment form (it includes the current path) |

Secret-name self-check (names must be plain ASCII):

```bash
pnpm exec wrangler secret list | python3 -c "import sys,json,re;ns=[s['name'] for s in json.loads(re.search(r'\[[\s\S]*\]',sys.stdin.read()).group(0))];bad=[n for n in ns if not n.isascii()];print('non-ascii names:', bad if bad else 'none')"
# expected list: ADMIN_TOKEN / GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / IP_HASH_SALT / SESSION_SECRET
```

Delete and re-set a mistyped name (quote it):

```bash
pnpm exec wrangler secret delete '<bad-name>'
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET
```
