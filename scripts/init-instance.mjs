#!/usr/bin/env node
/**
 * 创建一个「实例」骨架：一个只含身份 / 内容 / 资产，其余全部来自引擎的 SvelteKit 应用。
 *
 *   node scripts/init-instance.mjs ../my-site            # 目标目录
 *   node scripts/init-instance.mjs ../my-site --engine packages/sprout
 *
 * 生成的文件（已存在则跳过，绝不覆盖）：
 *
 *   package.json  svelte.config.js  vite.config.ts  tsconfig.json
 *   vitest.config.js  wrangler.toml  src/app.d.ts
 *   src/site/{config.js,assembly.js,pages/blogroll.svelte}
 *   src/content/{posts,notes}/.gitkeep
 *
 * 生成之后：把引擎放到 `<target>/packages/sprout`（推荐 git submodule），
 * `pnpm install && pnpm dev`，然后按 docs/INSTANCE.md 逐项填身份。
 *
 * 引擎仓库自己就是 demo 实例（`src/site/`），所以本脚本生成的是同一个形状 ——
 * 差别只在 `$site` 指向哪里。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const argv = process.argv.slice(2);
let targetArg = '.';
let enginePath = 'packages/sprout';
let nameFlag;
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === '--engine') enginePath = argv[++i];
	else if (a === '--name') nameFlag = argv[++i];
	else if (!a.startsWith('--')) targetArg = a;
}
const target = resolve(targetArg);
const siteName = nameFlag ?? target.split('/').pop() ?? 'my-site';

/** @param {string} rel @param {string} body */
function write(rel, body) {
	const file = join(target, rel);
	if (existsSync(file)) {
		console.log(`  skip   ${rel} (exists)`);
		return;
	}
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, body);
	console.log(`  write  ${rel}`);
}

console.log(`Scaffolding instance "${siteName}" in ${target}\n(engine: ${enginePath})\n`);

write(
	'package.json',
	`{
	"name": ${JSON.stringify(siteName)},
	"private": true,
	"type": "module",
	"version": "0.0.1",
	"scripts": {
		"dev": "vite dev",
		"dev:clean": "node ${enginePath}/scripts/dev-clean.mjs && vite dev",
		"prepare": "svelte-kit sync",
		"build": "vite build",
		"preview": "vite preview",
		"deploy": "wrangler deploy",
		"check": "svelte-check --tsconfig ./tsconfig.json",
		"test": "vitest run",
		"db:migrate:local": "wrangler d1 migrations apply DB --local",
		"db:migrate:remote": "wrangler d1 migrations apply DB --remote",
		"db:console:local": "wrangler d1 execute DB --local --command",
		"content:import": "node ${enginePath}/scripts/import.mjs",
		"content:export": "node ${enginePath}/scripts/export.mjs",
		"content:restore": "node ${enginePath}/scripts/restore.mjs",
		"content:verify": "node ${enginePath}/scripts/verify-mirror.mjs",
		"check:links": "node ${enginePath}/scripts/check-links.mjs",
		"check:sitemap": "node ${enginePath}/scripts/check-sitemap.mjs",
		"notify:indexnow": "node ${enginePath}/scripts/notify-indexnow.mjs"
	},
	"devDependencies": {
		"@sveltejs/adapter-cloudflare": "^7.2.9",
		"@sveltejs/kit": "^2.70.3",
		"@sveltejs/vite-plugin-svelte": "^7.3.0",
		"@types/markdown-it": "^14.2.0",
		"@types/node": "^26.6.5",
		"sharp": "^0.35.4",
		"svelte": "^5.57.0",
		"svelte-check": "^4.7.6",
		"vite": "^8.2.2",
		"vitest": "^5.0.5",
		"wrangler": "^4.127.1"
	},
	"dependencies": {
		"highlight.js": "^11.12.0",
		"markdown-it": "^15.0.3",
		"markdown-it-anchor": "^10.0.0"
	}
}
`
);

write(
	'svelte.config.js',
	`import adapter from '@sveltejs/adapter-cloudflare';
import path from 'node:path';

/**
 * The engine owns routes, lib, templates and hooks; this app owns identity,
 * content and assets. \`$site\` is the seam. See docs/INSTANCE.md.
 */
const KIT = path.resolve('${enginePath}/src');
const kit = (p) => path.join(KIT, p);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte'],
	kit: {
		adapter: adapter(),
		alias: {
			$site: path.resolve('src/site')
		},
		files: {
			routes: kit('routes'),
			lib: kit('lib'),
			appTemplate: kit('app.html'),
			hooks: { client: kit('hooks.js'), server: kit('hooks.server.js') },
			assets: path.resolve('static')
		}
	}
};

export default config;
`
);

write(
	'vite.config.ts',
	`import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
`
);

write(
	'tsconfig.json',
	`{
	"extends": "./.svelte-kit/tsconfig.json",
	"compilerOptions": {
		"allowJs": true,
		"checkJs": true,
		"esModuleInterop": true,
		"forceConsistentCasingInFileNames": true,
		"resolveJsonModule": true,
		"skipLibCheck": true,
		"sourceMap": true,
		"strict": true,
		"moduleResolution": "bundler"
	}
}
`
);

write(
	'vitest.config.js',
	`import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The engine's aliases, for tests that import engine modules directly.
const kit = (p) => fileURLToPath(new URL('${enginePath}/src/' + p, import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			$lib: kit('lib'),
			$site: fileURLToPath(new URL('./src/site', import.meta.url))
		}
	},
	test: {
		include: ['tests/**/*.test.{js,ts}'],
		environment: 'node'
	}
});
`
);

write(
	'wrangler.toml',
	`name = ${JSON.stringify(siteName)}
compatibility_date = "2025-09-22"
compatibility_flags = ["nodejs_compat"]

main = ".svelte-kit/cloudflare/_worker.js"

[assets]
directory = ".svelte-kit/cloudflare"
binding = "ASSETS"

[[d1_databases]]
binding = "DB"
database_name = ${JSON.stringify(`${siteName}-db`)}
database_id = "REPLACE-WITH-YOUR-D1-ID"
# The schema belongs to the engine — point wrangler at its migrations (inside the
# D1 entry, that is where wrangler reads it) so an engine upgrade is a
# \`pnpm db:migrate:remote\`, not a copy.
migrations_dir = "${enginePath}/migrations"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = ${JSON.stringify(`${siteName}-media`)}
`
);

write(
	'src/app.d.ts',
	`// Platform bindings — the one place the engine and the instance share types.
// Mirrors the engine's \`src/app.d.ts\`; keep them in sync when a binding changes.
declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				MEDIA: R2Bucket;
				ADMIN_TOKEN?: string;
				SESSION_SECRET?: string;
				IP_HASH_SALT?: string;
				GITHUB_CLIENT_ID?: string;
				GITHUB_CLIENT_SECRET?: string;
			};
			context: {
				waitUntil(promise: Promise<unknown>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
	}
}

export {};
`
);

write(
	'src/site/config.js',
	`/**
 * 「我是谁」——实例身份。引擎只通过 \`$site\` 读取它。
 * 字段说明见引擎的 docs/USAGE.md §2.1。
 */
/** @type {import('$lib/content/site').SiteConfig} */
export const site = {
	name: ${JSON.stringify(siteName)},
	url: 'https://example.com',
	author: ${JSON.stringify(siteName)},
	locales: [{ code: 'en', label: 'English', short: 'EN', intl: 'en-US' }],
	defaultLocale: 'en',
	ogImage: '/og-image.png',
	logo: '/logo.png',
	topics: [],
	contact: { email: 'hello@example.com', github: 'https://github.com/you' },
	brand: {
		en: {
			claim: 'Start small, grow in public.',
			claimSource: '',
			creed: ['Write', 'Keep', 'Export'],
			ogTagline: 'Write · Keep · Export',
			seoTitle: ${JSON.stringify(`${siteName} — a personal site`)},
			seoDescription: 'A data-portable personal site on Cloudflare Workers and D1.',
			feedDescription: 'Posts, notes and moments.'
		}
	}
};

export default site;
`
);

write(
	'src/site/assembly.js',
	`/**
 * 「我由什么构成」——实例装配。引擎合并它 + \`mods\` 得到唯一 registry。
 * 字段说明见引擎的 docs/USAGE.md §2.2。
 *
 * 文案（按钮、区块标题、About 页面）的站点差异写进 \`mods[].i18n\`，
 * 不要去改引擎的 \`src/lib/i18n/*.js\`：改引擎文件会让每次升级都冲突。
 */
/** @type {import('$lib/content/site').SiteAssembly['contentTypes']} */
export const contentTypes = {
	post: {
		type: 'post',
		route: '/posts',
		label: { en: 'Posts', zh: '文章' },
		public: true,
		feed: true,
		comments: true,
		schemaType: 'BlogPosting',
		fields: []
	},
	note: {
		type: 'note',
		route: '/notes',
		label: { en: 'Notes', zh: '笔记' },
		public: true,
		feed: true,
		comments: true,
		schemaType: 'Article',
		fields: []
	}
};

/** @type {import('$lib/content/site').SiteAssembly['features']} */
export const features = ['comments', 'analytics', 'timeline'];

/** @type {import('$lib/content/site').SiteAssembly['home']} */
export const home = {
	sections: [
		{
			types: ['post', 'note'],
			layout: 'list',
			title: 'home.selectedWriting',
			more: 'home.allWriting',
			morePath: 'posts',
			limit: 5
		}
	]
};

/** @type {import('$lib/content/site').SiteAssembly['theme']} */
export const theme = { name: 'classic', tokens: {} };

/**
 * Instance-only contributions. \`i18n\` deep-merges over the engine's
 * dictionaries (arrays replace wholesale), so this is where site copy lives.
 * @type {import('$lib/content/schema').Mod[]}
 */
export const mods = [
	// { id: 'site-copy', i18n: { en: { nav: { about: 'Me' } } } }
];

/** @type {import('$lib/content/site').SiteAssembly['privateRoutes']} */
export const privateRoutes = [];

/** @type {import('$lib/content/site').SiteAssembly['content']} */
export const content = { defaultVisibility: 'public', timelineOrder: 'published' };

/** @type {import('$lib/content/site').SiteAssembly['commentablePages']} */
export const commentablePages = [{ path: '/about', title: { en: 'About', zh: '关于' } }];

export default {
	contentTypes,
	features,
	home,
	theme,
	mods,
	privateRoutes,
	content,
	commentablePages
};
`
);

write(
	'src/site/pages/blogroll.svelte',
	`<script>
  /**
   * Page overlay for /blogroll — replace the import to restyle the page. The
   * route and its loader stay in the engine; the props are
   * { blogs, picks, latest }.
   */
  import BlogrollPage from '$lib/components/blogroll/BlogrollPage.svelte';

  const props = $props();
</script>

<BlogrollPage {...props} />
`
);

for (const dir of ['posts', 'notes']) write(`src/content/${dir}/.gitkeep`, '');

console.log(`
Next:
  1. git submodule add <sprout repo> ${enginePath}
  2. pnpm install
  3. fill in src/site/config.js (name, url, author, brand, locales)
  4. pnpm dev            # the engine's demo content is not here — add your own
  5. pnpm db:migrate:local && pnpm content:import && pnpm build
`);
