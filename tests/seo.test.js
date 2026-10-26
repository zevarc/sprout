import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { absoluteUrl, breadcrumbJsonLd, pageTitle, shareImage } from '$lib/seo';
import { nodeToView, structuredDataType } from '$lib/content/view';
import { createAsset } from '$lib/server/repositories/assets';
import { ensureOwner } from '$lib/server/repositories/people';
import { site } from '$lib/site';
import { GET as sitemap } from '../src/routes/sitemap.xml/+server';

describe('seo helpers', () => {
	it('builds titles and absolute urls per locale', () => {
		expect(pageTitle('Posts')).toBe(`Posts - ${site.name}`);
		expect(absoluteUrl('', site.defaultLocale)).toBe(`${site.url}/`);
		expect(absoluteUrl('posts/hello', site.defaultLocale)).toBe(`${site.url}/posts/hello`);
		const other = site.locales.find((l) => l.code !== site.defaultLocale);
		if (other) expect(absoluteUrl('posts/hello', other.code)).toBe(`${site.url}/${other.code}/posts/hello`);
	});

	it('points the share card at a raster image, with its size', () => {
		const share = shareImage('A title');
		// Social platforms ignore SVG, so this must never be an .svg
		expect(share.url).not.toMatch(/\.svg$/);
		expect(share.width).toBe(1200);
		expect(share.height).toBe(630);
		expect(share.alt).toBe('A title');
	});

	it('numbers breadcrumb items from one', () => {
		const crumb = breadcrumbJsonLd([
			{ name: 'Home', url: `${site.url}/` },
			{ name: 'Posts', url: `${site.url}/posts` }
		]);
		expect(crumb['@type']).toBe('BreadcrumbList');
		expect(crumb.itemListElement.map((i) => i.position)).toEqual([1, 2]);
	});
});

describe('structured data per kind', () => {
	it('describes the kind, not always a technical article', () => {
		expect(structuredDataType('post')).toBe('BlogPosting');
		expect(structuredDataType('moment')).toBe('SocialMediaPosting');
		expect(structuredDataType('nothing-declared')).toBe('CreativeWork');
	});

	it('carries language, keywords and the canonical page', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const asset = await createAsset(db, {
			type: 'post',
			slug: 'hello',
			lang: 'en',
			title: 'Hello',
			summary: 'A summary',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id,
			tags: ['android', 'c++']
		});
		const view = nodeToView(asset, true);
		expect(view.jsonLd['@type']).toBe('BlogPosting');
		expect(view.jsonLd.inLanguage).toBe('en');
		expect(view.jsonLd.keywords).toBe('android, c++');
		expect(view.jsonLd.mainEntityOfPage).toBe(`${site.url}/${view.url}`);
		expect(view.groupId).toBe(asset.groupId);
	});
});

describe('sitemap', () => {
	it('leaves noindex pages out and pairs each translation group', async () => {
		const { db } = createTestDb();
		const owner = await ensureOwner(db);
		const first = site.locales[0].code;
		const second = site.locales[1]?.code;

		await createAsset(db, {
			type: 'post',
			slug: 'hello',
			lang: first,
			title: 'Hello',
			bodyMd: 'x',
			status: 'published',
			authorId: owner.id
		});
		if (second) {
			await createAsset(db, {
				type: 'post',
				slug: '你好',
				lang: second,
				groupId: 'post:hello',
				title: '你好',
				bodyMd: 'x',
				status: 'published',
				authorId: owner.id
			});
		}

		const res = await sitemap(/** @type {any} */ ({ platform: { env: { DB: db } } }));
		const xml = await res.text();
		// Neither is indexable, so neither may be advertised.
		expect(xml).not.toMatch(/<loc>[^<]*\/search<\/loc>/);
		expect(xml).not.toMatch(/<loc>[^<]*\/timeline<\/loc>/);
		expect(xml).toMatch(/<loc>[^<]*\/posts\/hello<\/loc>/);
		if (second) {
			// One entry, both locales: the alternates are what make them a set.
			expect(xml).toContain('hreflang="x-default"');
			expect(xml).toContain(encodeURI('你好').length ? `/${second}/posts/` : '');
		}
	});
});
