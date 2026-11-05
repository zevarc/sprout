/**
 * Which error copy a status code gets.
 *
 * Four buckets, not one sentence per code: the page explains *why* an address
 * did not work, and inventing prose for codes the engine never raises (418,
 * 451, …) would be copy nobody can verify. `other` carries them all.
 *
 * @param {number} status
 * @returns {'notFound' | 'denied' | 'broken' | 'other'}
 */
export function statusCopy(status) {
	if (status === 404) return 'notFound';
	if (status === 401 || status === 403) return 'denied';
	if (status >= 500) return 'broken';
	return 'other';
}
