import type { Actor, ActorKind } from '$lib/content/types';
import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import { site } from '$lib/site';

interface ActorRow {
	id: string;
	kind: string;
	handle: string | null;
	display_name: string | null;
	avatar_url: string | null;
	email_hash: string | null;
	created_at: string;
}

function toActor(row: ActorRow): Actor {
	return {
		id: row.id,
		kind: row.kind as ActorKind,
		handle: row.handle,
		displayName: row.display_name,
		avatarUrl: row.avatar_url,
		emailHash: row.email_hash,
		createdAt: row.created_at
	};
}

export interface NewActor {
	kind: ActorKind;
	handle?: string | null;
	displayName?: string | null;
	avatarUrl?: string | null;
	emailHash?: string | null;
	emailEnc?: string | null;
}

export async function createActor(db: D1Database, input: NewActor): Promise<Actor> {
	const id = ulid();
	const now = new Date().toISOString();
	await run(
		db,
		`INSERT INTO actors (id, kind, handle, display_name, avatar_url, email_hash, email_enc, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.kind,
			input.handle ?? null,
			input.displayName ?? null,
			input.avatarUrl ?? null,
			input.emailHash ?? null,
			input.emailEnc ?? null,
			now
		]
	);
	return {
		id,
		kind: input.kind,
		handle: input.handle ?? null,
		displayName: input.displayName ?? null,
		avatarUrl: input.avatarUrl ?? null,
		emailHash: input.emailHash ?? null,
		createdAt: now
	};
}

export async function getActor(db: D1Database, id: string): Promise<Actor | null> {
	const row = await first<ActorRow>(db, 'SELECT * FROM actors WHERE id = ?', [id]);
	return row ? toActor(row) : null;
}

export async function getActorByEmailHash(
	db: D1Database,
	emailHash: string
): Promise<Actor | null> {
	const row = await first<ActorRow>(db, 'SELECT * FROM actors WHERE email_hash = ? LIMIT 1', [
		emailHash
	]);
	return row ? toActor(row) : null;
}

export async function getActorByIdentity(
	db: D1Database,
	provider: string,
	providerUid: string
): Promise<Actor | null> {
	const row = await first<ActorRow>(
		db,
		`SELECT a.* FROM actors a
		 JOIN actor_identities i ON i.actor_id = a.id
		 WHERE i.provider = ? AND i.provider_uid = ?
		 LIMIT 1`,
		[provider, providerUid]
	);
	return row ? toActor(row) : null;
}

export async function linkIdentity(
	db: D1Database,
	actorId: string,
	provider: string,
	providerUid: string
): Promise<void> {
	await run(
		db,
		`INSERT OR IGNORE INTO actor_identities (id, actor_id, provider, provider_uid, created_at)
		 VALUES (?, ?, ?, ?, ?)`,
		[ulid(), actorId, provider, providerUid, new Date().toISOString()]
	);
}

// ---- Sessions ----

interface SessionRow {
	id: string;
	actor_id: string;
	role: string;
	expires_at: string;
}

export async function createSession(
	db: D1Database,
	actorId: string,
	tokenHash: string,
	role: 'owner' | 'member' | 'visitor',
	ttlSeconds: number
): Promise<void> {
	const now = Date.now();
	await run(
		db,
		`INSERT INTO sessions (id, actor_id, token_hash, role, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[
			ulid(),
			actorId,
			tokenHash,
			role,
			new Date(now + ttlSeconds * 1000).toISOString(),
			new Date(now).toISOString()
		]
	);
}

export async function getSessionByTokenHash(
	db: D1Database,
	tokenHash: string
): Promise<{ actorId: string; role: string } | null> {
	const row = await first<SessionRow>(
		db,
		'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ? LIMIT 1',
		[tokenHash, new Date().toISOString()]
	);
	return row ? { actorId: row.actor_id, role: row.role } : null;
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
	await run(db, 'DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
}

/** Ensures a single owner actor exists, creating it on first use. */
export async function ensureOwner(db: D1Database): Promise<Actor> {
	const row = await first<ActorRow>(db, "SELECT * FROM actors WHERE kind = 'owner' LIMIT 1", []);
	if (row) return toActor(row);
	return createActor(db, { kind: 'owner', displayName: site.author, handle: site.name });
}

/** Member actors — the people who can sign in and record alongside the owner. */
export async function listMembers(db: D1Database): Promise<Actor[]> {
	const rows = await query<ActorRow>(
		db,
		"SELECT * FROM actors WHERE kind = 'member' ORDER BY created_at ASC"
	);
	return rows.map(toActor);
}

/** Display names by actor id — for timelines/attribution without a JOIN in routes. */
export async function listActorNames(db: D1Database): Promise<Record<string, string>> {
	const rows = await query<{ id: string; display_name: string | null }>(
		db,
		'SELECT id, display_name FROM actors'
	);
	return Object.fromEntries(rows.map((r) => [r.id, r.display_name ?? '']));
}

/** Removes a member and everything that let them in. */
export async function deleteActor(db: D1Database, id: string): Promise<void> {
	await run(db, 'DELETE FROM sessions WHERE actor_id = ?', [id]);
	await run(db, 'DELETE FROM actor_identities WHERE actor_id = ?', [id]);
	await run(db, 'DELETE FROM actors WHERE id = ?', [id]);
}
