import { site } from '$lib/site';

/**
 * Universal `reroute` hook (must live in `src/hooks.js`, not `hooks.server.js`).
 *
 * Maps `/<non-default-locale>/…` onto the single root route tree for **route
 * matching only** — `url.pathname` is left untouched, so loaders still see the
 * real, prefixed path and resolve the locale with `localeFromPath()`.
 *
 * This is what makes N languages need zero extra route files (verified by the
 * Phase B0 spike: the optional `[[lang]]` param mis-resolved `/posts/hello`).
 */
const NON_DEFAULT_LOCALES = site.locales
	.map((l) => l.code)
	.filter((code) => code !== site.defaultLocale);

/** @param {{ url: URL }} input */
export function reroute({ url }) {
	const segs = url.pathname.split('/').filter(Boolean);
	if (segs.length === 0 || !NON_DEFAULT_LOCALES.includes(segs[0])) return;
	const rest = segs.slice(1).join('/');
	return rest ? `/${rest}` : '/';
}
