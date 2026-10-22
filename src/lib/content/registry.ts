/**
 * Content type helpers. The *kinds* a site has come from the assembled registry
 * (base config + mods); this module gives them lookups and label resolution.
 */

import { contentTypes as assembledTypes } from '$lib/engine/registry';
import { site } from '$lib/site';
import type { ContentTypeDef, Label } from '$lib/content/schema';

export type { ContentTypeDef, FieldDef, FieldOption, Label } from '$lib/content/schema';

/** The site's declared types (base + contributions). */
export const contentTypes = assembledTypes;

export function getContentType(type: string): ContentTypeDef | undefined {
	return contentTypes[type];
}

/**
 * Resolves a type from its URL segment (e.g. `posts` → the `post` type). The
 * generic `[type]` routes use this, which requires a type's route to be a
 * single path segment (`/posts`, not `/lab/notes`).
 */
export function getTypeByRouteSegment(segment: string): ContentTypeDef | undefined {
	return listTypes().find((t) => t.route === `/${segment}`);
}

export function listTypes(): ContentTypeDef[] {
	return Object.values(contentTypes);
}

/** Types that have a public route (the shareable side of the site). */
export function publicTypes(): ContentTypeDef[] {
	return listTypes().filter((t) => t.public);
}

/** Types whose routes stay behind the owner/member session. */
export function privateTypes(): ContentTypeDef[] {
	return listTypes().filter((t) => !t.public);
}

/**
 * Public type routes that resolve to a generic list page — i.e. single-segment
 * routes. Multi-segment routes (e.g. `/lab/notes`) are served by their own static
 * routes and must not be advertised as list pages.
 */
export function listRouteSegments(): string[] {
	return publicTypes()
		.map((t) => t.route.replace(/^\//, ''))
		.filter((r) => r !== '' && !r.includes('/'));
}

/** Types feeding RSS/Atom, in registry order. */
export function feedTypes(): ContentTypeDef[] {
	return listTypes().filter((t) => t.feed);
}

/** Picks a label for the active locale, falling back to the default locale, then any. */
export function labelText(label: Label | undefined, lang: string, fallback = ''): string {
	if (!label) return fallback;
	return label[lang] ?? label[site.defaultLocale] ?? Object.values(label)[0] ?? fallback;
}
