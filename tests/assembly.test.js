import { describe, it, expect } from 'vitest';
import { mergeAssembly } from '$lib/engine/assembly';

/** @type {import('$lib/engine/assembly').BaseAssembly} */
const base = {
	contentTypes: {
		post: { type: 'post', route: '/posts', label: { en: 'Posts' }, fields: [] }
	},
	features: ['comments'],
	home: { sections: [] },
	theme: { name: 'classic', tokens: {} }
};

describe('assembly merge', () => {
	it('merges a mod’s types, features (deduped), home sections and tokens', () => {
		/** @type {import('$lib/content/schema').Mod} */
		const mod = {
			id: 'family',
			contentTypes: {
				toy: { type: 'toy', route: '/toys', label: { zh: '玩具' }, public: true, fields: [] }
			},
			features: ['members', 'members'],
			home: {
				sections: [
					{ types: ['toy'], layout: 'cards', title: 'x', more: 'y', morePath: 'toys', limit: 3 }
				]
			},
			theme: { tokens: { '--color-bud': '#123456' } }
		};

		const a = mergeAssembly(base, [mod]);
		expect(a.contentTypes.post).toBeDefined();
		expect(a.contentTypes.toy.route).toBe('/toys');
		expect(a.features).toEqual(['comments', 'members']);
		expect(a.home.sections).toHaveLength(1);
		expect(a.theme.tokens?.['--color-bud']).toBe('#123456');
		expect(a.mods).toHaveLength(1);
	});

	it('rejects a mod without an id', () => {
		expect(() =>
			mergeAssembly(base, [/** @type {any} */ ({ contentTypes: {} })])
		).toThrow();
	});
});
