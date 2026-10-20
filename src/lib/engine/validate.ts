/**
 * Startup validation of the site assembly.
 *
 * Configuration mistakes should fail loudly at boot, not 404 mysteriously at
 * runtime. Called from `hooks.server.js`; also covered by a unit test.
 */

import { contentTypes, features, mods } from '$lib/engine/registry';
import { site } from '$lib/site';
import { isKnownFeature } from '$lib/engine/features';

const LIST_RENDERERS = ['list', 'cards', 'feed'];
const DETAIL_RENDERERS = ['article', 'compact'];

/** @returns {string[]} human-readable problems (empty = valid) */
export function validateConfig(): string[] {
	const errors: string[] = [];
	const types = Object.values(contentTypes ?? {});

	const seenMods = new Set<string>();
	for (const mod of mods ?? []) {
		if (!mod?.id) errors.push('a mod is missing an `id`');
		else if (seenMods.has(mod.id)) errors.push(`duplicate mod id "${mod.id}"`);
		else seenMods.add(mod.id);
	}

	const seenRoutes = new Set<string>();
	for (const t of types) {
		if (typeof t.route !== 'string' || !t.route.startsWith('/')) {
			errors.push(`content type "${t.type}" route "${t.route}" must start with "/"`);
		}
		if (seenRoutes.has(t.route)) errors.push(`duplicate content type route "${t.route}"`);
		seenRoutes.add(t.route);
		if (!t.label || Object.keys(t.label).length === 0) {
			errors.push(`content type "${t.type}" has no label`);
		}
		if (t.listRenderer && !LIST_RENDERERS.includes(t.listRenderer)) {
			errors.push(
				`content type "${t.type}" has unknown listRenderer "${t.listRenderer}" (allowed: ${LIST_RENDERERS.join(', ')})`
			);
		}
		if (t.detailRenderer && !DETAIL_RENDERERS.includes(t.detailRenderer)) {
			errors.push(
				`content type "${t.type}" has unknown detailRenderer "${t.detailRenderer}" (allowed: ${DETAIL_RENDERERS.join(', ')})`
			);
		}
		// A multi-segment route is allowed, but it is served by its own static
		// routes — the generic `[type]` route only covers single-segment routes.
	}

	const localeCodes = (site.locales ?? []).map((l) => l.code);
	if (localeCodes.length === 0) errors.push('site.locales is empty');
	if (!localeCodes.includes(site.defaultLocale)) {
		errors.push(`defaultLocale "${site.defaultLocale}" is not one of site.locales`);
	}
	for (const code of localeCodes) {
		const collide = types.find((t) => t.route === `/${code}`);
		if (collide) {
			errors.push(`locale "${code}" collides with content type route "${collide.route}"`);
		}
	}

	for (const f of features ?? []) {
		if (!isKnownFeature(f)) errors.push(`unknown feature "${f}"`);
	}

	return errors;
}

export function assertValidConfig(): void {
	const errors = validateConfig();
	if (errors.length > 0) {
		throw new Error(`Invalid sprout config:\n - ${errors.join('\n - ')}`);
	}
}
