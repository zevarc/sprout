import { describe, it, expect } from 'vitest';
import {
	hashEmail,
	hashIp,
	randomToken,
	safeNextPath,
	signActorToken,
	verifyActorToken
} from '$lib/server/auth';

const SECRET = 'test-secret';

describe('actor token (signed cookie identity)', () => {
	it('round-trips a token', async () => {
		const token = await signActorToken('actor-1', SECRET);
		expect(await verifyActorToken(token, SECRET)).toBe('actor-1');
	});

	it('rejects a tampered token', async () => {
		const token = await signActorToken('actor-1', SECRET);
		const tampered = token.replace('actor-1', 'actor-2');
		expect(await verifyActorToken(tampered, SECRET)).toBeNull();
	});

	it('rejects a token signed with another secret', async () => {
		const token = await signActorToken('actor-1', SECRET);
		expect(await verifyActorToken(token, 'other-secret')).toBeNull();
	});

	it('rejects an expired token', async () => {
		const token = await signActorToken('actor-1', SECRET, -1);
		expect(await verifyActorToken(token, SECRET)).toBeNull();
	});
});

describe('privacy hashing', () => {
	it('hashes an IP deterministically per day, and rotates across days', async () => {
		const day1 = await hashIp('1.2.3.4', 'salt', '2026-01-01');
		const day1again = await hashIp('1.2.3.4', 'salt', '2026-01-01');
		const day2 = await hashIp('1.2.3.4', 'salt', '2026-01-02');

		expect(day1again).toBe(day1);
		expect(day2).not.toBe(day1);
		expect(day1).toHaveLength(64);
	});

	it('hashes emails case-insensitively and trims whitespace', async () => {
		expect(await hashEmail('Alice@Example.com', 'salt')).toBe(
			await hashEmail('  alice@example.com ', 'salt')
		);
	});

  it('produces unique random tokens', () => {
		const a = randomToken();
		const b = randomToken();
		expect(a).not.toBe(b);
		expect(a).toHaveLength(64);
	});
});

describe('post-login redirect guard', () => {
	it('accepts same-origin paths', () => {
		expect(safeNextPath('/zh/posts/hello')).toBe('/zh/posts/hello');
		expect(safeNextPath('/')).toBe('/');
	});

	it('rejects anything that leaves the site', () => {
		expect(safeNextPath('//evil.example')).toBeNull();
		expect(safeNextPath('https://evil.example')).toBeNull();
		expect(safeNextPath('/\\evil.example')).toBeNull();
		expect(safeNextPath('/a\nb')).toBeNull();
		expect(safeNextPath('posts/hello')).toBeNull();
	});

	it('rejects empty and oversized values', () => {
		expect(safeNextPath('')).toBeNull();
		expect(safeNextPath(null)).toBeNull();
		expect(safeNextPath(undefined)).toBeNull();
		expect(safeNextPath('/' + 'a'.repeat(400))).toBeNull();
	});
});
