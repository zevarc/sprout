import { describe, it, expect } from 'vitest';
import { validateConfig } from '$lib/engine/validate';
import { listFeatures } from '$lib/engine/features';
import { listTypes, publicTypes, getTypeByRouteSegment } from '$lib/content/registry';

describe('site assembly', () => {
	it('the shipped config is valid', () => {
		expect(validateConfig()).toEqual([]);
	});

	it('types come from the assembly and are single-segment routable', () => {
		const routeSegments = listTypes()
			.map((t) => t.route.replace(/^\//, ''))
			.filter((r) => !r.includes('/'));
		for (const seg of routeSegments) {
			expect(getTypeByRouteSegment(seg)?.route).toBe(`/${seg}`);
		}
		expect(publicTypes().length).toBeGreaterThan(0);
	});

	it('exposes the declared cross-cutting features', () => {
		expect(listFeatures()).toContain('comments');
	});
});
