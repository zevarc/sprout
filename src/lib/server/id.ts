/**
 * ULID: 48-bit time + 80-bit randomness, Crockford base32 (26 chars).
 * Lexicographically sortable, opaque, and stable — safe to use as a permanent
 * node id so that renaming a slug never breaks comment anchors.
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(now: number, len: number): string {
	let str = '';
	let t = now;
	for (let i = len - 1; i >= 0; i--) {
		const mod = t % 32;
		str = ENCODING[mod] + str;
		t = (t - mod) / 32;
	}
	return str;
}

function encodeRandom(len: number): string {
	const bytes = new Uint8Array(len);
	crypto.getRandomValues(bytes);
	let str = '';
	for (let i = 0; i < len; i++) str += ENCODING[bytes[i] % 32];
	return str;
}

export function ulid(now: number = Date.now()): string {
	return encodeTime(now, 10) + encodeRandom(16);
}
