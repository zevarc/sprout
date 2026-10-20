import { describe, it, expect } from 'vitest';
import { localeFromPath, getLink, homePath, stripLocale } from '$lib/i18n';
import { reroute } from '../src/hooks.js';

/** @param {string} p */
const url = (p) => new URL(`https://example.com${p}`);

describe('locale routing', () => {
	it('parses the active locale from a path', () => {
		expect(localeFromPath('/')).toBe('en');
		expect(localeFromPath('/zh')).toBe('zh');
		expect(localeFromPath('/zh/posts/hello')).toBe('zh');
		expect(localeFromPath('/posts/hello')).toBe('en');
	});

	it('builds and strips locale prefixes', () => {
		expect(getLink('posts', 'en')).toBe('posts');
		expect(getLink('posts', 'zh')).toBe('zh/posts');
		expect(homePath('en')).toBe('/');
		expect(homePath('zh')).toBe('/zh');

		expect(stripLocale('/zh/timeline')).toBe('/timeline');
		expect(stripLocale('/zh')).toBe('/');
		expect(stripLocale('/timeline')).toBe('/timeline');
	});

	it('reroutes non-default locales onto the single root tree', () => {
		expect(reroute({ url: url('/zh/posts/hello') })).toBe('/posts/hello');
		expect(reroute({ url: url('/zh') })).toBe('/');
		expect(reroute({ url: url('/zh/timeline') })).toBe('/timeline');
		expect(reroute({ url: url('/posts') })).toBeUndefined();
		expect(reroute({ url: url('/api/search') })).toBeUndefined();
	});
});
