import { describe, it, expect } from 'vitest';
import { site } from '$lib/site';
import { localeFromPath, getLink, homePath, stripLocale } from '$lib/i18n';
import { reroute } from '../src/hooks.js';

/**
 * Config-driven locale invariants: a single-language site has no prefixes at
 * all, a multi-language one puts non-default locales behind a prefix. Both
 * shapes must satisfy the same rules.
 */
const DEFAULT = site.defaultLocale;
const OTHER = site.locales.map((l) => l.code).find((code) => code !== DEFAULT);

/** @param {string} p */
const url = (p) => new URL(`https://example.com${p}`);

describe('locale routing', () => {
	it('parses the active locale from a path', () => {
		expect(localeFromPath('/')).toBe(DEFAULT);
		expect(localeFromPath('/posts/hello')).toBe(DEFAULT);
		if (OTHER) {
			expect(localeFromPath(`/${OTHER}`)).toBe(OTHER);
			expect(localeFromPath(`/${OTHER}/posts/hello`)).toBe(OTHER);
		}
	});

	it('builds and strips locale prefixes', () => {
		expect(getLink('posts', DEFAULT)).toBe('posts');
		expect(homePath(DEFAULT)).toBe('/');

		if (OTHER) {
			expect(getLink('posts', OTHER)).toBe(`${OTHER}/posts`);
			expect(homePath(OTHER)).toBe(`/${OTHER}`);
			expect(stripLocale(`/${OTHER}/timeline`)).toBe('/timeline');
			expect(stripLocale(`/${OTHER}`)).toBe('/');
		}

		expect(stripLocale('/timeline')).toBe('/timeline');
	});

	it('reroutes non-default locales onto the single root tree', () => {
		if (OTHER) {
			expect(reroute({ url: url(`/${OTHER}/posts/hello`) })).toBe('/posts/hello');
			expect(reroute({ url: url(`/${OTHER}`) })).toBe('/');
			expect(reroute({ url: url(`/${OTHER}/timeline`) })).toBe('/timeline');
		} else {
			// Single-language site: nothing is prefixed, so nothing is rewritten.
			expect(reroute({ url: url('/posts/hello') })).toBeUndefined();
		}

		expect(reroute({ url: url('/posts') })).toBeUndefined();
		expect(reroute({ url: url('/api/search') })).toBeUndefined();
	});
});
