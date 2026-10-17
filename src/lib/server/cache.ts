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
export function derivedPaths(nodeUrl?: string, slug?: string, lang?: string): string[] {
	const paths = [
		'/',
		'/zh',
		'/posts',
		'/zh/posts',
		'/moments',
		'/feed.xml',
		'/zh/feed.xml',
		'/sitemap.xml'
	];
	if (nodeUrl) paths.push(`/${nodeUrl}`);
	if (slug) paths.push(`/og/${slug}.svg`, `/zh/og/${slug}.svg`);
	if (lang) paths.push(`/${lang}/sitemap.xml`);
	return paths;
}
