import { site } from '$lib/site';

/**
 * Builds a page title: `<label> - <site name>`.
 * @param {string} label
 */
export function pageTitle(label) {
	return `${label} - ${site.name}`;
}

/**
 * Absolute URL of a site path in one locale. The default locale owns the
 * unprefixed URL, so `/zh` is a real route only for a non-default locale.
 * @param {string} path
 * @param {string} lang
 */
export function absoluteUrl(path = '', lang = site.defaultLocale) {
	const prefix = lang === site.defaultLocale ? '' : `/${lang}`;
	const suffix = path ? `/${path.replace(/^\//, '')}` : '/';
	return `${site.url}${prefix}${suffix}`;
}

/**
 * The share card. Facebook, X, LinkedIn and WeChat all reject SVG, so the meta
 * tags must point at a raster image — `site.ogImage` is that file.
 * @param {string} [alt]
 */
export function shareImage(alt) {
	return {
		url: `${site.url}${site.ogImage ?? '/og-image.png'}`,
		width: 1200,
		height: 630,
		alt: alt ?? site.name
	};
}

/**
 * BreadcrumbList for a detail page: home → list → item.
 * @param {{ name: string, url: string }[]} items absolute URLs, root first
 */
export function breadcrumbJsonLd(items) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map((item, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: item.name,
			item: item.url
		}))
	};
}
