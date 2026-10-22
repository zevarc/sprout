/**
 * Authentication & identity helpers (docs/DATA-MODEL.md §5).
 *
 * - Owner: exchanges `ADMIN_TOKEN` for a signed session cookie.
 * - Members: invited people; their authority is `people.role`.
 * - Anonymous: a signed cookie identifies a `people` row that has no role.
 *
 * Sessions carry **no role**: the role is read from `people` on every request, so
 * revoking a member takes effect immediately and there is one source of truth.
 */

import type { D1Database } from '$lib/server/db';
import type { RequestEvent } from '@sveltejs/kit';
import type { PersonRole } from '$lib/content/types';
import {
	createSession,
	deleteSession,
	ensureOwner,
	getSessionByTokenHash
} from './repositories/people';

const encoder = new TextEncoder();

export const SESSION_COOKIE = 'zc_session';
export const PERSON_COOKIE = 'zc_person';

const OWNER_TTL = 60 * 60 * 24 * 30; // 30 days
const ANON_TTL = 60 * 60 * 24 * 180; // 180 days

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

export async function sha256Hex(input: string): Promise<string> {
	return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(input)));
}

/** Irreversible email hash for dedupe. */
export async function hashEmail(email: string, salt: string): Promise<string> {
	return sha256Hex(`${salt}:email:${email.trim().toLowerCase()}`);
}

/** Rotating-salt IP hash — the raw IP is never stored. */
export async function hashIp(ip: string, salt: string, day: string): Promise<string> {
	return sha256Hex(`${salt}:ip:${day}:${ip}`);
}

export function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return toHex(bytes.buffer);
}

/**
 * Guards post-login redirects: only same-origin absolute paths are accepted,
 * so `?next=` can never bounce a visitor to another site.
 */
export function safeNextPath(value: string | null | undefined): string | null {
	if (!value || value.length > 300) return null;
	if (!value.startsWith('/') || value.startsWith('//')) return null;
	if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return null;
	return value;
}

// ---- anonymous person token (personId.expiry.signature) ----

export async function signPersonToken(
	personId: string,
	secret: string,
	ttl = ANON_TTL
): Promise<string> {
	const expiry = Math.floor(Date.now() / 1000) + ttl;
	const payload = `${personId}.${expiry}`;
	const sig = await hmac(secret, payload);
	return `${payload}.${sig}`;
}

export async function verifyPersonToken(
	token: string,
	secret: string
): Promise<string | null> {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [personId, expiryStr, sig] = parts;
	const expiry = Number(expiryStr);
	if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return null;
	const expected = await hmac(secret, `${personId}.${expiryStr}`);
	if (expected !== sig) return null;
	return personId;
}

// ---- sessions ----

export interface Session {
	personId: string;
	role: PersonRole | null;
}

export async function getSession(event: RequestEvent, db: D1Database): Promise<Session | null> {
	const secret = event.platform?.env?.SESSION_SECRET;
	if (!secret) return null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (!token) return null;
	const hash = await hmac(secret, token);
	return getSessionByTokenHash(db, hash);
}

/** Reads the anonymous person from the signed cookie, if present. */
export async function getPersonFromCookie(event: RequestEvent): Promise<string | null> {
	const secret = event.platform?.env?.SESSION_SECRET;
	if (!secret) return null;
	const token = event.cookies.get(PERSON_COOKIE);
	if (!token) return null;
	return verifyPersonToken(token, secret);
}

export async function issuePersonCookie(event: RequestEvent, personId: string): Promise<void> {
	const secret = event.platform?.env?.SESSION_SECRET;
	if (!secret) return;
	const token = await signPersonToken(personId, secret);
	event.cookies.set(PERSON_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: ANON_TTL
	});
}

export async function loginOwner(event: RequestEvent, db: D1Database): Promise<boolean> {
	const secret = event.platform?.env?.SESSION_SECRET;
	const adminToken = event.platform?.env?.ADMIN_TOKEN;
	if (!secret || !adminToken) return false;

	let provided = '';
	try {
		const body = await event.request.json();
		provided = String(body?.token ?? '');
	} catch {
		return false;
	}
	const expected = await sha256Hex(adminToken);
	const actual = await sha256Hex(provided);
	if (expected !== actual) return false;

	const owner = await ensureOwner(db);
	const token = randomToken();
	await createSession(db, owner.id, await hmac(secret, token), OWNER_TTL);
	event.cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: OWNER_TTL
	});
	return true;
}

export async function logout(event: RequestEvent, db: D1Database): Promise<void> {
	const secret = event.platform?.env?.SESSION_SECRET;
	const token = event.cookies.get(SESSION_COOKIE);
	if (secret && token) await deleteSession(db, await hmac(secret, token));
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
	event.cookies.delete(PERSON_COOKIE, { path: '/' });
}

/**
 * Hashes an opaque token with the session secret before it is stored or
 * compared — used for session cookies and invite links alike.
 */
export async function hashToken(secret: string, token: string): Promise<string> {
	return hmac(secret, token);
}

/**
 * Signs an existing person in as a member (used by the invite flow). The session
 * stores no role: `people.role` is the authority.
 */
export async function issueMemberSession(
	event: RequestEvent,
	db: D1Database,
	personId: string
): Promise<boolean> {
	const secret = event.platform?.env?.SESSION_SECRET;
	if (!secret) return false;

	const token = randomToken();
	await createSession(db, personId, await hmac(secret, token), OWNER_TTL);
	event.cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: OWNER_TTL
	});
	return true;
}

/** True for an owner, or a machine request carrying `Bearer ADMIN_TOKEN`. */
export async function isAdmin(event: RequestEvent, db: D1Database): Promise<boolean> {
	const adminToken = event.platform?.env?.ADMIN_TOKEN;
	const bearer = event.request.headers.get('authorization') ?? '';
	if (adminToken && bearer === `Bearer ${adminToken}`) return true;
	const session = await getSession(event, db);
	return session?.role === 'owner';
}

/**
 * True for anyone allowed to read/write content — an owner or member, or a
 * machine request carrying `Bearer ADMIN_TOKEN`.
 */
export async function isEditor(event: RequestEvent, db: D1Database): Promise<boolean> {
	const adminToken = event.platform?.env?.ADMIN_TOKEN;
	const bearer = event.request.headers.get('authorization') ?? '';
	if (adminToken && bearer === `Bearer ${adminToken}`) return true;
	const session = await getSession(event, db);
	return session?.role === 'owner' || session?.role === 'member';
}
