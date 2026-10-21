import { describe, it, expect } from 'vitest';
import { generateRss } from '$lib/feed';
import { site } from '$lib/site';

/** Minimal PostView shape the feed needs. */
const view = {
	title: 'T',
	url: 'posts/t',
	date: '2026-01-01T00:00:00.000Z',
	excerpt: 'e',
	description: 'd'
};

describe('rss feed localization', () => {
	it('takes the channel title and <language> from the dictionary', () => {
		const en = generateRss([/** @type {any} */ (view)], 'en');
		expect(en).toContain(`<title>${site.name} - Blog</title>`);
		expect(en).toContain('<language>en</language>');

		const zh = generateRss([/** @type {any} */ (view)], 'zh');
		expect(zh).toContain(`<title>${site.name} - 博客</title>`);
		expect(zh).toContain('<language>zh-cn</language>');
	});

	it('falls back to the locale code when a language has no dictionary', () => {
		const ja = generateRss([/** @type {any} */ (view)], 'ja');
		expect(ja).toContain('<language>ja</language>');
	});

	it('points each locale at its own feed URL', () => {
		expect(generateRss([], 'en')).toContain(`href="${site.url}/feed.xml"`);
		expect(generateRss([], 'zh')).toContain(`href="${site.url}/zh/feed.xml"`);
	});
});
