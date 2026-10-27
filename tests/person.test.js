import { describe, it, expect } from 'vitest';
import { personJsonLd } from '$lib/content/person';
import { site } from '$lib/site';

describe('the site owner as structured data', () => {
	it('is one entity with a stable @id', () => {
		const person = personJsonLd(site.defaultLocale);
		expect(person['@type']).toBe('Person');
		expect(person['@id']).toBe(`${site.url}/#person`);
		expect(person.name).toBe(site.name);
		expect(person.url).toBe(site.url);
	});

	it('carries the declared logo and topics when the site has them', () => {
		const person = personJsonLd(site.defaultLocale);
		if (site.logo) {
			expect(person.image.url).toBe(`${site.url}${site.logo}`);
			expect(person.logo.url).toBe(`${site.url}${site.logo}`);
			expect(person.logo.width).toBe(512);
		}
		if (site.topics?.length) expect(person.knowsAbout).toEqual(site.topics);
	});

	it('lets a page refine it without changing the identity', () => {
		const person = personJsonLd(site.defaultLocale, { jobTitle: 'Android developer' });
		expect(person.jobTitle).toBe('Android developer');
		expect(person['@id']).toBe(`${site.url}/#person`);
	});
});
