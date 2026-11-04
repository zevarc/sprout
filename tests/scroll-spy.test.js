import { describe, it, expect } from 'vitest';
import { ownerHeading, pickActiveIndex, scrollTarget, tocRows } from '$lib/scroll-spy';

describe('table of contents position', () => {
	const tops = [0, 400, 900, 1500];

	it('treats the opening section as current above the first heading', () => {
		expect(pickActiveIndex(tops, -200)).toBe(0);
		expect(pickActiveIndex(tops, 0)).toBe(0);
	});

	it('picks the last heading at or above the reading line', () => {
		expect(pickActiveIndex(tops, 1)).toBe(0);
		expect(pickActiveIndex(tops, 399)).toBe(0);
		expect(pickActiveIndex(tops, 400)).toBe(1);
		expect(pickActiveIndex(tops, 1200)).toBe(2);
		expect(pickActiveIndex(tops, 99999)).toBe(3);
	});

	it('survives an empty article', () => {
		expect(pickActiveIndex([], 0)).toBe(0);
	});

	it('scrolls a heading just below the sticky header, never above the top', () => {
		expect(scrollTarget(1000, 80)).toBe(920);
		expect(scrollTarget(40, 80)).toBe(0);
	});
});

describe('table of contents folding', () => {
	const headings = [
		{ id: 'a', text: 'A', level: 2 },
		{ id: 'a1', text: 'A1', level: 3 },
		{ id: 'a2', text: 'A2', level: 4 },
		{ id: 'b', text: 'B', level: 2 },
		{ id: 'b1', text: 'B1', level: 3 },
		{ id: 'c', text: 'C', level: 2 }
	];

	it('shows everything on a short document', () => {
		expect(tocRows(headings, { denseAt: 16 }).map((r) => r.h.id)).toEqual([
			'a',
			'a1',
			'a2',
			'b',
			'b1',
			'c'
		]);
	});

	it('folds to all h2 plus the current section when dense', () => {
		const rows = tocRows(headings, { activeId: 'b1', denseAt: 3 });
		expect(rows.map((r) => r.h.id)).toEqual(['a', 'b', 'b1', 'c']);
		expect(rows.map((r) => r.i)).toEqual([0, 3, 4, 5]);
	});

	it('shows all children of the current h2 even when it is active itself', () => {
		const rows = tocRows(headings, { activeId: 'a', denseAt: 3 });
		expect(rows.map((r) => r.h.id)).toEqual(['a', 'a1', 'a2', 'b', 'c']);
	});

	it('expands to the full list when asked', () => {
		const rows = tocRows(headings, { activeId: 'b1', denseAt: 3, expandAll: true });
		expect(rows).toHaveLength(headings.length);
	});

	it('finds the owning section', () => {
		expect(ownerHeading(headings, 'a2')).toBe('a');
		expect(ownerHeading(headings, 'b1')).toBe('b');
		expect(ownerHeading(headings, 'c')).toBe('c');
		expect(ownerHeading([], 'x')).toBe('');
	});
});
