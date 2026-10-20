/**
 * Pure assembly merge: base site config + mod contributions → one registry.
 *
 * No Svelte, no DB, no config imports — so it is trivially testable.
 */

import type { ContentTypeDef, HomeSection, Mod } from '$lib/content/schema';

export interface BaseAssembly {
	contentTypes: Record<string, ContentTypeDef>;
	features: string[];
	home: { sections: HomeSection[] };
	theme: { name?: string; tokens?: Record<string, string> };
}

export interface Assembly extends BaseAssembly {
	mods: Mod[];
	/** Deep-merged dictionary fragments contributed by mods, keyed by locale. */
	i18n: Record<string, Record<string, unknown>>;
}

/** Merges plain objects recursively; arrays and scalars are replaced. */
function deepMerge(
	base: Record<string, unknown>,
	extra: Record<string, unknown>
): Record<string, unknown> {
	const out: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(extra)) {
		const prev = out[key];
		const bothObjects =
			prev !== null &&
			typeof prev === 'object' &&
			!Array.isArray(prev) &&
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value);
		out[key] = bothObjects
			? deepMerge(prev as Record<string, unknown>, value as Record<string, unknown>)
			: value;
	}
	return out;
}

export function mergeAssembly(base: BaseAssembly, mods: Mod[] = []): Assembly {
	const contentTypes: Record<string, ContentTypeDef> = { ...base.contentTypes };
	const features = new Set<string>(base.features);
	const sections: HomeSection[] = [...base.home.sections];
	const tokens: Record<string, string> = { ...base.theme.tokens };
	const i18n: Record<string, Record<string, unknown>> = {};

	for (const mod of mods) {
		if (!mod || typeof mod.id !== 'string' || !mod.id) {
			throw new Error('a mod is missing a non-empty `id`');
		}
		Object.assign(contentTypes, mod.contentTypes ?? {});
		for (const f of mod.features ?? []) features.add(f);
		sections.push(...(mod.home?.sections ?? []));
		Object.assign(tokens, mod.theme?.tokens ?? {});
		for (const [lang, fragment] of Object.entries(mod.i18n ?? {})) {
			i18n[lang] = deepMerge(i18n[lang] ?? {}, fragment);
		}
	}

	return {
		contentTypes,
		features: [...features],
		home: { sections },
		theme: { name: base.theme.name, tokens },
		mods,
		i18n
	};
}
