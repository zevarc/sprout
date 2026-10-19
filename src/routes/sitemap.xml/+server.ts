import { getDb } from '$lib/server/db';
import { listViews, type PostView } from '$lib/content/view';
import { site } from '$lib/site';

export const prerender = false;

const SITE_URL = site.url;

interface UrlEntry {
	path: string;
	lastmod?: string;
}

function lastmodOf(view: PostView): string {
	return new Date(view.updated).toISOString().slice(0, 10);
}

/** Entry for a path that exists in both `en` and `zh` (with hreflang alternates). */
function entry(path: string, lastmod?: string): string {
	const enHref = path === '' ? `${SITE_URL}/` : `${SITE_URL}/${path}`;
	const zhHref = path === '' ? `${SITE_URL}/zh` : `${SITE_URL}/zh/${path}`;
	const lastmodTag = lastmod ? `\n        <lastmod>${lastmod}</lastmod>` : '';
	return `
    <url>
        <loc>${enHref}</loc>${lastmodTag}
        <xhtml:link rel="alternate" hreflang="en" href="${enHref}"/>
        <xhtml:link rel="alternate" hreflang="zh" href="${zhHref}"/>
        <xhtml:link rel="alternate" hreflang="x-default" href="${enHref}"/>
    </url>`;
}

/** Entry for a path that exists in one language only (e.g. moments). */
function entrySingle(path: string, lastmod?: string): string {
	const href = path === '' ? `${SITE_URL}/` : `${SITE_URL}/${path}`;
	const lastmodTag = lastmod ? `\n        <lastmod>${lastmod}</lastmod>` : '';
	return `
    <url>
        <loc>${href}</loc>${lastmodTag}
    </url>`;
}

export async function GET({ platform }) {
	const db = getDb(platform);
	const posts = await listViews(db, { types: ['post'], lang: 'en', limit: 200 });
	const notes = await listViews(db, { types: ['note'], lang: 'en', limit: 200 });
	const projects = await listViews(db, { types: ['project'], lang: 'en', limit: 200 });
	const moments = await listViews(db, { types: ['moment'], lang: 'en', limit: 200 });

	const fixedI18n: UrlEntry[] = [
		{ path: '' },
		{ path: 'posts' },
		{ path: 'projects' },
		{ path: 'about' },
		{ path: 'search' }
	];
	const contentI18n: UrlEntry[] = [
		...posts.map((p) => ({ path: `posts/${p.slug}`, lastmod: lastmodOf(p) })),
		...notes.map((n) => ({ path: `posts/notes/${n.slug}`, lastmod: lastmodOf(n) })),
		...projects.map((p) => ({ path: `projects/${p.slug}`, lastmod: lastmodOf(p) }))
	];

	const urls =
		[...fixedI18n, ...contentI18n].map((u) => entry(u.path, u.lastmod)).join('') +
		entrySingle('moments') +
		moments.map((m) => entrySingle(`moments/${m.slug}`, lastmodOf(m))).join('');

	const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
    xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>${urls}
</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
		}
	});
}
