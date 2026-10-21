import { describe, it, expect } from 'vitest';
import { formatDate, formatDateFor, formatMonth, formatMonthFor, dirFor, dirOf, localeMeta } from '$lib/i18n';
import { site } from '$lib/site';

const ISO = '2026-01-02T03:04:05.000Z';

describe('locale-aware date formatting', () => {
	it('defaults to the terse YYYY.MM.DD the site has always used', () => {
		expect(formatDate(ISO)).toBe('2026.01.02');
		expect(formatDate(ISO, site.defaultLocale)).toBe('2026.01.02');
	});

	it("honours a locale's own Intl format instead of the default", () => {
		/** @type {{ code: string, intl: string, dateFormat: Intl.DateTimeFormatOptions }} */
		const meta = {
			code: 'xx',
			intl: 'en-US',
			dateFormat: { year: 'numeric', month: 'long', day: 'numeric' }
		};
		expect(formatDateFor(ISO, meta)).toBe('January 2, 2026');
	});

	it('falls back to the raw date prefix when the input is unparseable', () => {
		expect(formatDate('2026-13-99T00:00:00Z')).toBe('2026-13-99');
	});

	it('renders the same instant for every locale in the default style', () => {
		expect(formatDate(ISO, 'zh')).toBe('2026.01.02');
	});
});

describe('locale-aware month headings', () => {
	it('is terse YYYY.MM by default', () => {
		expect(formatMonth(ISO)).toBe('2026.01');
	});

	it("drops the day from a locale's own date format", () => {
		/** @type {{ code: string, intl: string, dateFormat: Intl.DateTimeFormatOptions }} */
		const meta = {
			code: 'xx',
			intl: 'en-US',
			dateFormat: { year: 'numeric', month: 'long', day: 'numeric' }
		};
		expect(formatMonthFor(ISO, meta)).toBe('January 2026');
	});
});

describe('writing direction', () => {
	it('is ltr unless a locale declares rtl', () => {
		expect(dirFor(site.defaultLocale)).toBe('ltr');
		expect(dirOf(undefined)).toBe('ltr');
		expect(dirOf({ dir: 'ltr' })).toBe('ltr');
		expect(dirOf({ dir: 'rtl' })).toBe('rtl');
	});

	it('falls back to the default locale for an unknown code', () => {
		expect(localeMeta('does-not-exist')).toEqual(localeMeta(site.defaultLocale));
	});
});
