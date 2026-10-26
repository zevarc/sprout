import { getDb } from '$lib/server/db';
import { listTags } from '$lib/server/repositories/tags';
import { listViews, type PostView } from '$lib/content/view';
import { publicTypes, listRouteSegments } from '$lib/content/registry';
import { site } from '$lib/site';

export const prerender = false;

const SITE_URL = site.url;
const LOCALES = site.locales.map((l) => l.code);

function lastmodOf(view: PostView): string {
	return new Date(view.updated).toISOString().slice(0, 10);
}

function url(locale: string, path: string): string {
	const prefix = locale === site.defaultLocale ? '' : `/${locale}`;
	return `${SITE_URL}${prefix}${path ? `/${path}` : '/'}`;
}

/**
 * One URL entry. `pathsByLocale` holds the path of the *same* thing in each
 * locale — translations may use different slugs, so the paths may differ. When
 * more than one locale has it, hreflang alternates are emitted: one entry per
 * translation group is what tells a crawler these pages are alternates of each
 * other rather than unrelated pages. Only public routes are ever passed here.
 */
function entry(pathsByLocale: Record<string, string>, lastmod?: string): string {
	const locales = LOCALES.filter((l) => pathsByLocale[l]);
	if (locales.length === 0) return '';
	// The default locale owns the unprefixed URL, whatever order `site.locales` is in.
	const primary = locales.includes(site.defaultLocale) ? site.defaultLocale : locales[0];
	const lastmodTag = lastmod ? `\n        <lastmod>${lastmod}</lastmod>` : '';
	const alts =
		locales.length > 1
			? locales
					.map(
						(l) =>
							`\n        <xhtml:link rel="alternate" hreflang="${l}" href="${url(l, pathsByLocale[l])}"/>`
					)
					.join('') +
				`\n        <xhtml:link rel="alternate" hreflang="x-default" href="${url(primary, pathsByLocale[primary])}"/>`
			: '';
	// Every locale gets its own `<url>` entry, each carrying the same alternate
	// set: sitemap.org asks for one entry per URL, and an entry per group would
	// leave the non-default locales reachable only through the alternates.
	return locales
		.map(
			(locale) => `
    <url>
        <loc>${url(locale, pathsByLocale[locale])}</loc>${lastmodTag}${alts}
    </url>`
		)
		.join('');
}

/** A path that exists in every locale (`/`, `/about`, `/tags`, one per kind). */
function everywhere(path: string): Record<string, string> {
	return Object.fromEntries(LOCALES.map((l) => [l, path]));
}

export async function GET({ platform }) {
	const db = getDb(platform);
	const urls: string[] = [];

	// Only single-segment type routes have a generic list page (multi-segment
	// routes are served by their own static routes); listing the others would
	// publish a dead URL.
	//
	// `/search` and `/timeline` are absent on purpose: both render `noindex`, and
	// a sitemap that advertises them contradicts the pages themselves.
	const fixed = ['', 'about', 'tags', ...listRouteSegments()];
	for (const path of fixed) urls.push(entry(everywhere(path)));

	for (const type of publicTypes()) {
		const base = type.route.replace(/^\//, '');
		// Group by translation id: one entry per group, carrying each locale's own
		// slug.
		const byGroup = new Map<string, { paths: Record<string, string>; lastmod: string }>();
		for (const locale of LOCALES) {
			const views = await listViews(db, { types: [type.type], lang: locale, limit: 200 });
			for (const view of views) {
				const group = byGroup.get(view.groupId) ?? { paths: {}, lastmod: '' };
				group.paths[locale] = `${base}/${view.slug}`;
				const stamp = lastmodOf(view);
				if (stamp > group.lastmod) group.lastmod = stamp;
				byGroup.set(view.groupId, group);
			}
		}
		for (const group of byGroup.values()) urls.push(entry(group.paths, group.lastmod));
	}

	// A tag exists only in the locales that actually carry it, so a tag page is
	// never advertised where it would 404.
	const byTag = new Map<string, Record<string, string>>();
	for (const locale of LOCALES) {
		const tags = await listTags(db, { lang: locale, types: publicTypes().map((t) => t.type) });
		for (const tag of tags) {
			const paths = byTag.get(tag.tag) ?? {};
			paths[locale] = `tags/${encodeURIComponent(tag.tag)}`;
			byTag.set(tag.tag, paths);
		}
	}
	for (const paths of byTag.values()) urls.push(entry(paths));

	const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>${urls.join('')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
		}
	});
}
