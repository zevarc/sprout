/**
 * Cross-cutting capabilities, assembled from `sprout.config.js` plus mods.
 *
 * Content *types* are not features — declaring a type gives it routes. These are
 * the orthogonal capabilities (comments, members, analytics, timeline…) that a
 * site switches on; everything in the engine gates on `hasFeature`.
 */

import { features as assembledFeatures } from '$lib/engine/registry';

/** Capability ids the engine knows how to honour. */
export const KNOWN_FEATURES = ['comments', 'members', 'analytics', 'timeline'] as const;
export type FeatureId = (typeof KNOWN_FEATURES)[number];

const enabled = new Set<string>(assembledFeatures ?? []);

/** True when the site has switched a cross-cutting capability on. */
export function hasFeature(id: string): boolean {
	return enabled.has(id);
}

export function listFeatures(): string[] {
	return [...enabled];
}

export function isKnownFeature(id: string): boolean {
	return (KNOWN_FEATURES as readonly string[]).includes(id);
}
