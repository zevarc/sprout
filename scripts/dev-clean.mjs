#!/usr/bin/env node
/**
 * Kills stale Vite dev/preview processes *for this project only* and clears the
 * Vite/SvelteKit caches.
 *
 * Needed whenever route files were renamed, added or deleted (e.g. a
 * `+page.ts` becoming `+page.server.ts`): a long-running dev server keeps a
 * stale module graph and can then 500 on every data-backed route.
 *
 *   pnpm dev:clean
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const CWD = process.cwd();

function sh(cmd) {
	try {
		return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
	} catch {
		return '';
	}
}

// Scoped to this project's node_modules path, so other projects are untouched.
// `workerd` is miniflare's runtime (it serves the local D1 binding); it is a
// child of the Vite process and gets orphaned if Vite is killed abruptly.
const patterns = [`${CWD}/node_modules/.*vite`, `${CWD}/node_modules/.*workerd`];

const pids = [
	...new Set(
		patterns
			.flatMap((pattern) => sh(`pgrep -f "${pattern}"`).split('\n'))
			.map((s) => s.trim())
			.filter((s) => s && s !== String(process.pid))
	)
];

for (const pid of pids) sh(`kill ${pid}`);
console.log(
	pids.length ? `Stopped ${pids.length} stale dev process(es) for ${CWD}.` : 'No stale dev processes.'
);

for (const dir of ['node_modules/.vite', '.svelte-kit']) {
	rmSync(dir, { recursive: true, force: true });
}
console.log('Cleared node_modules/.vite and .svelte-kit.');

// Regenerate .svelte-kit so `pnpm check` works immediately after cleaning.
try {
	execSync('pnpm exec svelte-kit sync', { stdio: 'ignore' });
	console.log('Regenerated .svelte-kit.');
} catch {
	console.warn('Could not run `svelte-kit sync` — run it manually if `pnpm check` complains.');
}
