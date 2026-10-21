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

function href(path: string, locale: string): string {
	const prefix = locale === site.defaultLocale ? '' : `/${locale}`;
	const suffix = path ? `/${path}` : '/';
	return `${SITE_URL}${prefix}${suffix}`;
}

/**
 * A URL entry. `locales` are the locales that actually have this path; when
 * more than one, hreflang alternates are emitted. Only public routes are ever
 * passed here — private types have no public URL at all.
 */
function entry(path: string, locales: string[], lastmod?: string): string {
	const lastmodTag = lastmod ? `\n        <lastmod>${lastmod}</lastmod>` : '';
	const alts =
		locales.length > 1
			? locales
					.map((l) => `\n        <xhtml:link rel="alternate" hreflang="${l}" href="${href(path, l)}"/>`)
					.join('') +
				`\n        <xhtml:link rel="alternate" hreflang="x-default" href="${href(path, locales[0])}"/>`
			: '';
	return `
    <url>
        <loc>${href(path, locales[0])}</loc>${lastmodTag}${alts}
    </url>`;
}

export async function GET({ platform }) {
	const db = getDb(platform);
	const urls: string[] = [];

	// Only single-segment type routes have a generic list page (multi-segment
	// routes are served by their own static routes); listing the others would
	// publish a dead URL.
	const fixed = ['', 'about', 'search', 'tags', ...listRouteSegments()];
	for (const path of fixed) urls.push(entry(path, LOCALES));

	for (const locale of LOCALES) {
		for (const type of publicTypes()) {
			const base = type.route.replace(/^\//, '');
			const views = await listViews(db, { types: [type.type], lang: locale, limit: 200 });
			for (const view of views) {
				urls.push(entry(`${base}/${view.slug}`, [locale], lastmodOf(view)));
			}
		}

		const tags = await listTags(db, { lang: locale, types: ['post', 'note'] });
		for (const tag of tags) {
			urls.push(entry(`tags/${encodeURIComponent(tag.tag)}`, [locale]));
		}
	}

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
