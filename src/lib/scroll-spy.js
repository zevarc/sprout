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
