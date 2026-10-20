import { listTypes } from '$lib/content/registry';
import { site } from '$lib/site';

/**
 * Targeted edge-cache purge.
 *
 * Content pages are deliberately NOT cached: instant publishing wins over
 * cache hits. Only feed/sitemap/og (which are safe to serve slightly stale)
 * carry a short `s-maxage`, and publishing invalidates them here.
 */
export async function purgeCache(origin: string, paths: string[]): Promise<void> {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	if (!cache) return;

	await Promise.all(
		paths.map(async (path) => {
			try {
				await cache.delete(new Request(new URL(path, origin).toString()));
			} catch {
				/* cache unavailable — nothing to do */
			}
		})
	);
}

/** The set of derived URLs affected whenever content changes. */
export function derivedPaths(nodeUrl?: string, slug?: string): string[] {
	const prefixes = site.locales.map((l) => (l.code === site.defaultLocale ? '' : `/${l.code}`));
	const paths = new Set<string>(['/sitemap.xml']);
	for (const prefix of prefixes) {
		paths.add(prefix || '/');
		paths.add(`${prefix}/feed.xml`);
		for (const type of listTypes()) paths.add(`${prefix}${type.route}`);
	}
	if (nodeUrl) paths.add(`/${nodeUrl}`);
	if (slug) for (const prefix of prefixes) paths.add(`${prefix}/og/${slug}.svg`);
	return [...paths];
}

/**
 * The single entry point for invalidating derived output after a write.
 * Routes must call one of these instead of building path arrays themselves.
 */
export async function invalidateNode(
	origin: string,
	nodeUrl?: string,
	slug?: string
): Promise<void> {
	await purgeCache(origin, derivedPaths(nodeUrl, slug));
}

/** Invalidate everything derived (structural changes: import, restore, grouping). */
export async function invalidateAll(origin: string): Promise<void> {
	await purgeCache(origin, derivedPaths());
}
