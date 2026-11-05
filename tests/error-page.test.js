import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dictionaries, supportedLanguages } from '$lib/i18n';
import { statusCopy } from '$lib/components/error/copy.js';

/** The four copy buckets the error page knows how to render. */
const BUCKETS = ['notFound', 'denied', 'broken', 'other'];

describe('error copy buckets', () => {
	it('maps 404 to "gone" copy', () => {
		expect(statusCopy(404)).toBe('notFound');
	});

	it('maps authentication and authorisation failures together', () => {
		expect(statusCopy(401)).toBe('denied');
		expect(statusCopy(403)).toBe('denied');
	});

	it('maps every 5xx to the "our fault" copy', () => {
		expect(statusCopy(500)).toBe('broken');
		expect(statusCopy(503)).toBe('broken');
		expect(statusCopy(599)).toBe('broken');
	});

	it('keeps unknown statuses out of the specific buckets', () => {
		for (const status of [0, 4, 400, 418, 451]) {
			expect(statusCopy(status)).toBe('other');
		}
	});
});

describe('error dictionary', () => {
	const dicts = supportedLanguages.map((code) => [code, dictionaries[code]]);

	it('ships an error section for every locale the site serves', () => {
		for (const [code, dict] of dicts) {
			expect(dict?.error, `locale ${code}`).toBeDefined();
		}
	});

	it('has one title and one body sentence per bucket', () => {
		for (const [code, dict] of dicts) {
			expect(Object.keys(dict.error.title).sort(), `locale ${code}`).toEqual([...BUCKETS].sort());
			expect(Object.keys(dict.error.body).sort(), `locale ${code}`).toEqual([...BUCKETS].sort());
			for (const bucket of BUCKETS) {
				expect(dict.error.title[bucket].trim(), `${code}/title/${bucket}`).not.toBe('');
				expect(dict.error.body[bucket].trim(), `${code}/body/${bucket}`).not.toBe('');
			}
		}
	});

	it('keeps the same keys as the default locale', () => {
		const reference = Object.keys(dicts[0][1].error).sort();
		for (const [code, dict] of dicts) {
			expect(Object.keys(dict.error).sort(), `locale ${code}`).toEqual(reference);
		}
	});

	it('leaves only {status} as a placeholder', () => {
		for (const [code, dict] of dicts) {
			expect(dict.error.code, `locale ${code}`).toContain('{status}');
			const prose = [
				dict.error.kicker,
				dict.error.home,
				dict.error.search,
				dict.error.latest,
				...BUCKETS.map((b) => dict.error.title[b]),
				...BUCKETS.map((b) => dict.error.body[b])
			].join(' ');
			expect(prose, `locale ${code}`).not.toMatch(/\{[a-z]+\}/i);
		}
	});
});

describe('error page wiring', () => {
	const route = readFileSync(new URL('../src/routes/+error.svelte', import.meta.url), 'utf8');
	const page = readFileSync(
		new URL('../src/lib/components/error/ErrorPage.svelte', import.meta.url),
		'utf8'
	);

	it('feeds the route status and the real path into the page', () => {
		expect(route).toContain('$page.status');
		expect(route).toContain('localeFromPath');
		expect(page).toContain('statusCopy');
	});

	it('keeps error pages out of search results', () => {
		expect(page).toContain('name="robots"');
		expect(page).toContain('noindex');
	});
});
