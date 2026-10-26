import { describe, it, expect } from 'vitest';
import {
	getTypeByRouteSegment,
	publicTypes,
	privateTypes,
	feedTypes,
	labelText,
	listRouteSegments,
	publicListTypes,
	listTypes
} from '$lib/content/registry';

/**
 * These assertions are written against whatever `sprout.config.js` declares —
 * they are engine invariants, not a demo-site fixture. Any site can run them.
 */
const types = listTypes();
/** @param {string} route */
const segmentOf = (route) => route.replace(/^\//, '');

describe('content registry', () => {
	it('resolves every single-segment type from its route segment', () => {
		for (const type of types) {
			const segment = segmentOf(type.route);
			if (segment.includes('/')) continue;
			expect(getTypeByRouteSegment(segment)?.type).toBe(type.type);
		}
		expect(getTypeByRouteSegment('definitely-not-a-type')).toBeUndefined();
	});

	it('does not resolve multi-segment routes by their last segment', () => {
		for (const type of types) {
			const segment = segmentOf(type.route);
			if (!segment.includes('/')) continue;
			// The generic `[type]` route only ever receives one segment, so the
			// last segment of a nested route must not resolve on its own.
			const last = segment.split('/').pop();
			expect(getTypeByRouteSegment(String(last))).toBeUndefined();
		}
	});

	it('splits public and private types exhaustively', () => {
		expect(publicTypes().length + privateTypes().length).toBe(types.length);
		const seen = new Set([...publicTypes(), ...privateTypes()].map((t) => t.type));
		expect(seen.size).toBe(types.length);
	});

	it('reports only feed types as feeding the feed', () => {
		expect(feedTypes().every((t) => t.feed === true)).toBe(true);
	});

	it('uses known renderer keys', () => {
		const listRenderers = ['list', 'cards', 'feed'];
		const detailRenderers = ['article', 'compact'];
		for (const type of types) {
			if (type.listRenderer) expect(listRenderers).toContain(type.listRenderer);
			if (type.detailRenderer) expect(detailRenderers).toContain(type.detailRenderer);
		}
	});

	it('advertises exactly the single-segment public routes as list pages', () => {
		const segments = listRouteSegments();
		for (const type of publicTypes()) {
			const segment = segmentOf(type.route);
			if (segment.includes('/')) {
				expect(segments).not.toContain(segment);
			} else {
				expect(segments).toContain(segment);
			}
		}
	});

	it('picks a label for the active locale with fallbacks', () => {
		expect(labelText({ en: 'A', zh: 'B' }, 'zh')).toBe('B');
		expect(labelText({ zh: 'B' }, 'en')).toBe('B');
		expect(labelText(undefined, 'en', 'X')).toBe('X');
	});

	it('offers exactly the declared public single-segment types as nav links', () => {
		const nav = publicListTypes();
		for (const type of nav) {
			expect(type.public).toBe(true);
			expect(segmentOf(type.route).includes('/')).toBe(false);
		}
		// Nothing private, and nothing that only exists as a nested route.
		for (const type of types) {
			if (type.public && !segmentOf(type.route).includes('/')) {
				expect(nav.map((t) => t.type)).toContain(type.type);
			} else {
				expect(nav.map((t) => t.type)).not.toContain(type.type);
			}
		}
	});
});
