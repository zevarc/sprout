# Running a site on the engine

A **site** (an *instance*) owns identity, content and assets. The **engine**
(this repo) owns routes, data layer, renderers, components, migrations, tests and
tooling. An instance therefore has no `src/routes/`, no `src/lib/`, no hooks and
no migrations of its own — it points SvelteKit at the engine and adds only what
makes it *this* site.

```bash
node <engine>/scripts/init-instance.mjs ../my-site --name my-site
```

That writes the skeleton below. The rest of this page is why each file exists.

---

## 1. Layout

```
my-site/                       # the app: a SvelteKit project root
├─ packages/sprout/            # the engine (git submodule or subtree)
├─ svelte.config.js            # files.* → packages/sprout/src/**, alias $site → src/site
├─ vite.config.ts              # plugins: [sveltekit()]
├─ tsconfig.json               # extends ./.svelte-kit/tsconfig.json
├─ vitest.config.js            # same $lib/$site aliases as the engine
├─ wrangler.toml               # [[d1_databases]] migrations_dir → packages/sprout/migrations
├─ src/
│  ├─ app.d.ts                 # platform bindings (D1Database, R2Bucket, secrets)
│  ├─ site/
│  │  ├─ config.js             # 「我是谁」      → $site/config
│  │  └─ assembly.js           # 「我由什么构成」 → $site/assembly
│  ├─ content/{posts,notes}/   # markdown sources
│  └─ lib/…                    # optional: site-only components
├─ static/                     # logo, share card, robots, images
└─ .dev.vars                   # local secrets (never committed)
```

The engine is **inside the project root** on purpose: `svelte-check` only maps
generated `./$types` for source files under the root. A `pnpm link:` to a
sibling directory still builds, but the type gate degrades into ~100 `Cannot
find module './$types.js'` errors.

### Getting the engine in

```bash
git submodule add git@github.com:zevarc/sprout.git packages/sprout
git submodule update --init --recursive      # after cloning
git submodule update --remote packages/sprout # to bump the engine
```

`git subtree` works identically if you prefer no submodules; only the bump
command changes (`git subtree pull --prefix packages/sprout <repo> main`).

---

## 2. The seam: `$site`

`kit.alias.$site` is the single contract. The engine imports identity and
assembly through it:

```
src/lib/site.js      → export { site } from '$site/config'
src/lib/sprout.js    → export { contentTypes, … } from '$site/assembly'
```

The `files` mapping that makes the engine's own shell active:

```js
files: {
	routes: kit('routes'),
	lib: kit('lib'),
	appTemplate: kit('app.html'),
	// `hooks.js` is the universal hook (the locale reroute). Kit's key is
	// `universal` — mapping it to `client` silently drops the reroute and every
	// `/<locale>/…` URL 404s.
	hooks: { universal: kit('hooks.js'), server: kit('hooks.server.js') },
	assets: path.resolve('static')
}
```

…which is why nothing else in the engine changes. In the engine's own repo the
alias points at its own `src/site/` (the demo instance), so the same code runs
both ways.

Two shapes are checked against `lib/content/site.ts` — `SiteConfig` and
`SiteAssembly` — so an instance gets the engine's type safety for free:

```js
/** @type {import('$lib/content/site').SiteConfig} */
export const site = { … };
```

### Moving off `link:` directories

`kit.files` is resolved with `path.resolve`, so any real directory works:

| Option | `files.*` | Notes |
|---|---|---|
| Submodule/subtree inside the root | `packages/sprout/src/…` | **recommended** — instant edits, clean type gate |
| npm dependency (`@sprout/kit`) | `node_modules/@sprout/kit/src/…` | works; add `"exclude"` to tsconfig so Kit's default `node_modules/**` exclusion does not drop the engine from `include` |

The engine's own check config is `tsconfig.check.json`, not `tsconfig.json`, so a
vendored copy never hijacks Vite's tsconfig discovery inside the app.

---

## 3. What lives where

| Path | Owner | Why |
|---|---|---|
| `src/routes/**` | engine | universal `[type]` routes, API, sitemap, feed, OG |
| `src/lib/**` (except the two files above) | engine | data layer, renderers, components |
| `src/app.html`, `src/hooks*.js`, `src/styles/**` | engine | shell, locale reroute, security headers, theme tokens |
| `migrations/**`, `tests/**`, `scripts/**` | engine | schema, invariants, tooling |
| `static/fonts` | — | gone: fonts are bundled from `lib/assets/fonts` |
| `src/site/config.js` | instance | identity |
| `src/site/assembly.js` | instance | types, features, home, theme, mods, private routes |
| `src/site/pages/**` | instance | optional page overlays (none out of the box) |
| `src/content/**` | instance | markdown sources |
| `src/app.d.ts` | instance | platform bindings — keep in sync with the engine's |
| `wrangler.toml`, `.dev.vars*`, `static/*`, `.github/**` | instance | deployment — `migrations_dir` goes **inside** `[[d1_databases]]`, that is where wrangler reads it |

Sites that consume the engine also add the engine's runtime dependencies
(`highlight.js`, `markdown-it`, `markdown-it-anchor`) to their `package.json`,
because engine modules import them as bare specifiers.

---

## 4. Site copy: mods, not engine edits

Interface wording (nav labels, section titles, the About page) belongs to the
site. Put it in `mods[].i18n` in `src/site/assembly.js` — the engine deep-merges
it over its own dictionaries, arrays replacing wholesale:

```js
export const mods = [
	{
		id: 'site-copy',
		i18n: {
			en: { nav: { about: 'Me' }, home: { selectedWriting: 'Latest writing' } },
			zh: { nav: { about: '关于我' } }
		}
	}
];
```

Editing `src/lib/i18n/*.js` also works, but every engine release then conflicts
on those two files. Don't.

The engine's dictionaries are the *baseline* (demo copy included) — an instance
that wants different About paragraphs overrides the whole `about` arrays.

---

## 5. Page overlays

A route and its `load` stay in the engine; the rendering is a component the site
may replace. No overlay ships out of the box — the seam exists for sites that
want a bespoke page without forking a route:

```svelte
<!-- src/site/pages/<name>.svelte — the route imports this file -->
<script>
	import DefaultPage from '$lib/components/<name>/DefaultPage.svelte';
	const props = $props();
</script>

<DefaultPage {...props} />
```

Replace the import (keep the route's props) to restyle it. Engine upgrades never
touch this file; the loader keeps its shape.

A *new* route cannot be added from the instance — `kit.files.routes` is one
directory. Adding a page is an engine change; adding a **design** is an overlay.

---

## 6. Tooling

```bash
pnpm dev                 # vite dev — serves the app, routes come from packages/sprout
pnpm check               # svelte-check: the app's src + the engine's routes/lib
pnpm test                # instance tests (engine tests live in the engine repo)
pnpm build               # adapter-cloudflare
pnpm db:migrate:local    # wrangler reads migrations_dir → packages/sprout/migrations
pnpm db:migrate:remote
pnpm content:export      # engine scripts resolve the instance from cwd
```

Engine scripts read the instance from the working directory
(`scripts/lib/site.mjs`): `SITE_DIR` if set, else `cwd`. So
`node packages/sprout/scripts/export.mjs` run from the app root exports *this*
site.

Running the engine's own test suite still happens in the engine checkout
(`cd packages/sprout && pnpm install && pnpm test`) — the instance does not need
those dev dependencies.

---

## 7. Upgrading

```bash
git submodule update --remote packages/sprout   # swap the pointer
pnpm install                                     # new engine deps, if any
pnpm check && pnpm test && pnpm build
pnpm db:migrate:remote                          # if migrations/** changed
```

Because no engine file is copied, there is nothing to reconcile: a `git diff` in
`packages/sprout` shows exactly what the engine changed, and the instance's own
diff shows only its files.

Contributing back: fix the engine in the engine repo first, bump the pointer
afterwards. Downstream adapts to upstream, never the reverse.
