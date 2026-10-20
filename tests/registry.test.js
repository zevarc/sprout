import { describe, it, expect } from 'vitest';
import {
	getTypeByRouteSegment,
	publicTypes,
	privateTypes,
	feedTypes,
	labelText,
	listRouteSegments,
	listTypes
} from '$lib/content/registry';

describe('content registry', () => {
	it('resolves a type from its single-segment route', () => {
		expect(getTypeByRouteSegment('posts')?.type).toBe('post');
		expect(getTypeByRouteSegment('moments')?.type).toBe('moment');
		expect(getTypeByRouteSegment('projects')?.type).toBe('project');
		expect(getTypeByRouteSegment('nope')).toBeUndefined();
	});

	it('does not resolve multi-segment routes', () => {
		// `note` lives at `/posts/notes`, so it is served by its own static route.
		expect(getTypeByRouteSegment('notes')).toBeUndefined();
	});

	it('splits public and private types exhaustively', () => {
		expect(publicTypes().length + privateTypes().length).toBe(listTypes().length);
		expect(publicTypes().map((t) => t.type)).toContain('post');
	});

	it('reports only feed types as feeding the feed', () => {
		expect(feedTypes().every((t) => t.feed === true)).toBe(true);
	});

	it('lets a type select built-in renderers', () => {
		const moment = getTypeByRouteSegment('moments');
		expect(moment?.listRenderer).toBe('feed');
		expect(moment?.detailRenderer).toBe('compact');
	});

	it('advertises only single-segment public routes as list pages', () => {
		const segments = listRouteSegments();
		expect(segments).toContain('posts');
		expect(segments).toContain('moments');
		// `/posts/notes` has no generic list page — it must not be advertised.
		expect(segments).not.toContain('posts/notes');
	});

	it('picks a label for the active locale with fallbacks', () => {
		expect(labelText({ en: 'A', zh: 'B' }, 'zh')).toBe('B');
		expect(labelText({ zh: 'B' }, 'en')).toBe('B');
		expect(labelText(undefined, 'en', 'X')).toBe('X');
	});
});
