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
}

export function mergeAssembly(base: BaseAssembly, mods: Mod[] = []): Assembly {
	const contentTypes: Record<string, ContentTypeDef> = { ...base.contentTypes };
	const features = new Set<string>(base.features);
	const sections: HomeSection[] = [...base.home.sections];
	const tokens: Record<string, string> = { ...base.theme.tokens };

	for (const mod of mods) {
		if (!mod || typeof mod.id !== 'string' || !mod.id) {
			throw new Error('a mod is missing a non-empty `id`');
		}
		Object.assign(contentTypes, mod.contentTypes ?? {});
		for (const f of mod.features ?? []) features.add(f);
		sections.push(...(mod.home?.sections ?? []));
		Object.assign(tokens, mod.theme?.tokens ?? {});
	}

	return {
		contentTypes,
		features: [...features],
		home: { sections },
		theme: { name: base.theme.name, tokens },
		mods
	};
}
