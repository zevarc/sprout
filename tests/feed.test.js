import { describe, it, expect } from 'vitest';
import { generateRss } from '$lib/feed';
import { site } from '$lib/site';
import { dictionaries } from '$lib/i18n';

/** Minimal PostView shape the feed needs. */
const view = {
	title: 'T',
	url: 'posts/t',
	date: '2026-01-01T00:00:00.000Z',
	excerpt: 'e',
	description: 'd'
};

// Expectations come from the site's own dictionaries and locale list — an
// instance may rename the channel or add languages, and the tests still hold.
describe('rss feed localization', () => {
	it('takes the channel title and <language> from each locale dictionary', () => {
		for (const locale of site.locales) {
			const xml = generateRss([/** @type {any} */ (view)], locale.code);
			const label = dictionaries[locale.code]?.feed?.label;
			const language = dictionaries[locale.code]?.feed?.language;
			if (label) expect(xml).toContain(`<title>${site.name} - ${label}</title>`);
			if (language) expect(xml).toContain(`<language>${language}</language>`);
		}
	});

	it('falls back to the locale code when a language has no dictionary', () => {
		const ja = generateRss([/** @type {any} */ (view)], 'ja');
		expect(ja).toContain('<language>ja</language>');
	});

	it('points each locale at its own feed URL', () => {
		for (const locale of site.locales) {
			const home = locale.code === site.defaultLocale ? '' : `/${locale.code}`;
			expect(generateRss([], locale.code)).toContain(`href="${site.url}${home}/feed.xml"`);
		}
	});
});
