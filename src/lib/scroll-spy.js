/**
 * Reading-position arithmetic for the table of contents.
 *
 * Pure functions only: the component owns the DOM, this owns the maths, so the
 * "which section am I in" rule can be tested without a browser.
 */

/**
 * Index of the heading that owns the current reading position.
 *
 * `tops` are absolute document offsets (ascending). The active section is the
 * last heading at or above `line`; above the first heading the first section is
 * active, which is what a reader sees at the top of an article (the old code
 * kept the previously active id instead, so the highlight went stale).
 *
 * @param {number[]} tops
 * @param {number} line  absolute scroll position plus the anchor offset
 * @returns {number} index into `tops`; 0 when `tops` is empty
 */
export function pickActiveIndex(tops, line) {
	if (tops.length === 0) return 0;

	let low = 0;
	let high = tops.length - 1;
	let found = 0;

	while (low <= high) {
		const mid = (low + high) >> 1;
		if (tops[mid] <= line) {
			found = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	return found;
}

/**
 * Scroll offset that puts `top` just below the sticky header.
 * @param {number} top     absolute document offset of the target
 * @param {number} offset  sticky header height + breathing room
 */
export function scrollTarget(top, offset) {
	return Math.max(0, Math.round(top - offset));
}

/** @typedef {import('$lib/reading').TocItem} TocItem */

/**
 * The h2 that owns the reading position — the section the reader is inside.
 * @param {TocItem[]} headings
 * @param {string} activeId
 * @returns {string} heading id, or '' when there is no h2 at all
 */
export function ownerHeading(headings, activeId) {
	let owner = headings.find((h) => h.level === 2)?.id ?? '';
	const active = headings.findIndex((h) => h.id === activeId);
	for (let i = 0; i <= active; i++) {
		if (headings[i].level === 2) owner = headings[i].id;
	}
	return owner;
}

/**
 * Rows the TOC should render.
 *
 * Short documents show everything. Past `denseAt` the list folds to "all h2 +
 * the children of the current h2", which keeps it scannable while still showing
 * where the reader actually is; `expandAll` restores the full list.
 *
 * @param {TocItem[]} headings
 * @param {{ activeId?: string, denseAt?: number, expandAll?: boolean }} [options]
 * @returns {{ h: TocItem, i: number }[]}
 */
export function tocRows(headings, options = {}) {
	const { activeId = '', denseAt = 16, expandAll = false } = options;
	const index = new Map(headings.map((h, i) => [h.id, i]));

	if (headings.length <= denseAt || expandAll) {
		return headings.map((h) => ({ h, i: index.get(h.id) ?? 0 }));
	}

	const owner = ownerHeading(headings, activeId);
	const rows = [];
	let current = '';
	for (const h of headings) {
		if (h.level === 2) current = h.id;
		if (h.level === 2 || current === owner) rows.push({ h, i: index.get(h.id) ?? 0 });
	}
	return rows;
}
