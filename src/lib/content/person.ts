/**
 * The person behind the site, as structured data.
 *
 * Declared once and reused by every page that describes the author (the home
 * page's `WebSite`, the About page's `AboutPage`, and the `author`/`publisher`
 * of each article), so search engines see one consistent entity with one `@id`
 * instead of a different half-filled `Person` per page.
 *
 * Client-safe: it only reads `site.config.js`.
 */

import { site } from '$lib/site';

/** Extra, page-specific fields for the shared person node. */
export interface PersonExtras {
	description?: string;
	jobTitle?: string;
}

export interface PersonConfig {
	/** Absolute or site-relative logo/portrait used as the entity's image. */
	logo?: string;
	/** What the person works on, for `knowsAbout`. */
	topics?: string[];
}

function absolute(path: string): string {
	return path.startsWith('http') ? path : `${site.url}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * schema.org `Person` for the site owner. Optional fields are omitted rather
 * than filled with empty values — a sparse but valid node beats a noisy one.
 */
export function personJsonLd(lang: string = site.defaultLocale, extra: PersonExtras = {}) {
	const brand = site.brand?.[lang] ?? site.brand?.[site.defaultLocale];
	const person = {
		'@type': 'Person',
		'@id': `${site.url}/#person`,
		name: site.name,
		url: site.url,
		...(site.author ? { alternateName: site.author } : {}),
		...(site.contact?.github ? { sameAs: [site.contact.github] } : {}),
		...(site.contact?.email ? { email: `mailto:${site.contact.email}` } : {}),
		...(extra.jobTitle ? { jobTitle: extra.jobTitle } : {}),
		...(extra.description ?? brand?.seoDescription
			? { description: extra.description ?? brand?.seoDescription }
			: {}),
		...(site.topics?.length ? { knowsAbout: site.topics } : {}),
		...(site.logo
			? {
					image: { '@type': 'ImageObject', url: absolute(site.logo), width: 512, height: 512 },
					logo: { '@type': 'ImageObject', url: absolute(site.logo), width: 512, height: 512 }
				}
			: {})
	};
	return person;
}
