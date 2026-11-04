import { describe, it, expect } from 'vitest';
import { pickActiveIndex, scrollTarget } from '$lib/scroll-spy';

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
