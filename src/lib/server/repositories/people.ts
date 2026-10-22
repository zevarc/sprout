/**
 * `people`, `identities`, `sessions` (docs/DATA-MODEL.md §4.1–4.3, §5).
 *
 * One table for every human. Authority is `people.role` and nowhere else: sessions
 * carry no role, so revoking a member is one value change and takes effect at once.
 */

import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import type { Person, PersonRole } from '$lib/content/types';
import { site } from '$lib/site';

interface PersonRow {
	id: string;
	role: string | null;
	handle: string | null;
	display_name: string | null;
	avatar_url: string | null;
	email_hash: string | null;
	created_at: string;
	updated_at: string;
}

function toPerson(row: PersonRow): Person {
	return {
		id: row.id,
		role: (row.role as PersonRole | null) ?? null,
		handle: row.handle,
		displayName: row.display_name,
		avatarUrl: row.avatar_url,
		emailHash: row.email_hash,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface NewPerson {
	role?: PersonRole | null;
	handle?: string | null;
	displayName?: string | null;
	avatarUrl?: string | null;
	emailHash?: string | null;
}

export async function createPerson(db: D1Database, input: NewPerson): Promise<Person> {
	const id = ulid();
	const now = new Date().toISOString();
	await run(
		db,
		`INSERT INTO people (id, role, handle, display_name, avatar_url, email_hash, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.role ?? null,
			input.handle ?? null,
			input.displayName ?? null,
			input.avatarUrl ?? null,
			input.emailHash ?? null,
			now,
			now
		]
	);
	return {
		id,
		role: input.role ?? null,
		handle: input.handle ?? null,
		displayName: input.displayName ?? null,
		avatarUrl: input.avatarUrl ?? null,
		emailHash: input.emailHash ?? null,
		createdAt: now,
		updatedAt: now
	};
}

export async function getPerson(db: D1Database, id: string): Promise<Person | null> {
	const row = await first<PersonRow>(db, 'SELECT * FROM people WHERE id = ?', [id]);
	return row ? toPerson(row) : null;
}

export async function getPersonByEmailHash(
	db: D1Database,
	emailHash: string
): Promise<Person | null> {
	const row = await first<PersonRow>(db, 'SELECT * FROM people WHERE email_hash = ? LIMIT 1', [
		emailHash
	]);
	return row ? toPerson(row) : null;
}

export async function getPersonByIdentity(
	db: D1Database,
	provider: string,
	providerUid: string
): Promise<Person | null> {
	const row = await first<PersonRow>(
		db,
		`SELECT p.* FROM people p
		   JOIN identities i ON i.person_id = p.id
		  WHERE i.provider = ? AND i.provider_uid = ?
		  LIMIT 1`,
		[provider, providerUid]
	);
	return row ? toPerson(row) : null;
}

export async function linkIdentity(
	db: D1Database,
	personId: string,
	provider: string,
	providerUid: string
): Promise<void> {
	await run(
		db,
		`INSERT INTO identities (provider, provider_uid, person_id, created_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT(provider, provider_uid) DO NOTHING`,
		[provider, providerUid, personId, new Date().toISOString()]
	);
}

/** Ensures the single owner exists, creating it on first use. */
export async function ensureOwner(db: D1Database): Promise<Person> {
	const row = await first<PersonRow>(db, "SELECT * FROM people WHERE role = 'owner' LIMIT 1", []);
	if (row) return toPerson(row);
	return createPerson(db, {
		role: 'owner',
		displayName: site.author,
		handle: site.name
	});
}

/** Members, in creation order. */
export async function listMembers(db: D1Database): Promise<Person[]> {
	const rows = await query<PersonRow>(
		db,
		"SELECT * FROM people WHERE role = 'member' ORDER BY created_at ASC"
	);
	return rows.map(toPerson);
}

/** Display names by person id — attribution without a JOIN in routes. */
export async function listPersonNames(db: D1Database): Promise<Record<string, string>> {
	const rows = await query<{ id: string; display_name: string | null }>(
		db,
		'SELECT id, display_name FROM people'
	);
	return Object.fromEntries(rows.map((r) => [r.id, r.display_name ?? '']));
}

/**
 * Revokes membership without erasing the person: the row stays, so everything
 * they wrote keeps its attribution. Session and external-account rows go, and the
 * email hash is cleared.
 */
export async function retirePerson(db: D1Database, id: string): Promise<void> {
	await run(db, 'UPDATE people SET role = NULL, email_hash = NULL, updated_at = ? WHERE id = ?', [
		new Date().toISOString(),
		id
	]);
	await run(db, 'DELETE FROM sessions WHERE person_id = ?', [id]);
	await run(db, 'DELETE FROM identities WHERE person_id = ?', [id]);
}

// ---- sessions ----

export interface SessionIdentity {
	personId: string;
	role: PersonRole | null;
}

export async function createSession(
	db: D1Database,
	personId: string,
	tokenHash: string,
	ttlSeconds: number
): Promise<void> {
	const now = new Date();
	await run(
		db,
		'INSERT INTO sessions (token_hash, person_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
		[tokenHash, personId, new Date(now.getTime() + ttlSeconds * 1000).toISOString(), now.toISOString()]
	);
}

/** Resolves a session; the role comes from `people`, the single authority. */
export async function getSessionByTokenHash(
	db: D1Database,
	tokenHash: string
): Promise<SessionIdentity | null> {
	const row = await first<{ person_id: string; role: string | null }>(
		db,
		`SELECT s.person_id, p.role
		   FROM sessions s JOIN people p ON p.id = s.person_id
		  WHERE s.token_hash = ? AND s.expires_at > ?
		  LIMIT 1`,
		[tokenHash, new Date().toISOString()]
	);
	return row ? { personId: row.person_id, role: (row.role as PersonRole | null) ?? null } : null;
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
	await run(db, 'DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

/** Prunes expired sessions (called from the maintenance pass). */
export async function pruneExpiredSessions(db: D1Database): Promise<number> {
	const result = await run(db, 'DELETE FROM sessions WHERE expires_at <= ?', [
		new Date().toISOString()
	]);
	const meta = result.meta as { changes?: number } | undefined;
	return meta?.changes ?? 0;
}

/** Every person for the export (deterministic order). */
export async function exportPersonRows(db: D1Database): Promise<Record<string, unknown>[]> {
	const rows = await query<Record<string, unknown>>(
		db,
		`SELECT id, role, handle, display_name, avatar_url, email_hash, created_at, updated_at
		   FROM people ORDER BY id`
	);
	return rows;
}

/** Every external account for the export. */
export async function exportIdentityRows(db: D1Database): Promise<Record<string, unknown>[]> {
	return query<Record<string, unknown>>(
		db,
		'SELECT provider, provider_uid, person_id, created_at FROM identities ORDER BY person_id, provider'
	);
}
