import { site } from '$lib/site';

/**
 * Builds a page title: `<label> - <site name>`.
 * @param {string} label
 */
export function pageTitle(label) {
	return `${label} - ${site.name}`;
}
