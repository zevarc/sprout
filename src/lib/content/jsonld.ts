/**
 * schema.org mapping for structured data.
 *
 * Separate from `content/view.ts` on purpose: the view layer reads the
 * repositories, which must never be reachable from a component in the browser.
 * A site can override the type per kind with `schemaType` in `sprout.config.js`.
 */

import { getContentType } from '$lib/content/registry';

const DEFAULT_SCHEMA_TYPES: Record<string, string> = {
	post: 'BlogPosting',
	note: 'Article',
	moment: 'SocialMediaPosting',
	project: 'SoftwareSourceCode'
};

/** The declared schema type for a kind, falling back to what the kind is. */
export function structuredDataType(type: string): string {
	return getContentType(type)?.schemaType ?? DEFAULT_SCHEMA_TYPES[type] ?? 'CreativeWork';
}
