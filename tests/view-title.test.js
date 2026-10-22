import { describe, it, expect } from 'vitest';
import { nodeToView } from '$lib/content/view';

/**
 * Only the fields the title fallback reads matter here.
 * @param {Partial<import('$lib/content/types').ContentNode>} [overrides]
 * @returns {import('$lib/content/types').ContentNode}
 */
function node(overrides = {}) {
	return {
		id: 'A1',
		type: 'moment',
		lang: 'zh',
		slug: 'search-and-traffic',
		title: null,
		summary: null,
		bodyMd: '',
		bodyHtml: '',
		groupId: 'G1',
		status: 'published',
		visibility: 'public',
		createdAt: '2026-10-20T00:00:00.000Z',
		updatedAt: '2026-10-20T00:00:00.000Z',
		publishedAt: '2026-10-20T00:00:00.000Z',
		occurredAt: null,
		authorId: 'P1',
		fields: {},
		tags: [],
		media: [],
		coverMediaId: null,
		...overrides
	};
}

describe('untitled content', () => {
	it('falls back to the summary, then the slug — never an empty title', () => {
		expect(nodeToView(node({ summary: '只要有搜索框的地方就有流量' })).title).toBe(
			'只要有搜索框的地方就有流量'
		);
		expect(nodeToView(node({ title: '   ' })).title).toBe('search-and-traffic');
		expect(nodeToView(node({ title: '  A real title  ' })).title).toBe('A real title');
	});

	it('uses the same title for structured data', () => {
		expect(nodeToView(node({ summary: 'Summary as title' })).jsonLd.headline).toBe(
			'Summary as title'
		);
	});
});
