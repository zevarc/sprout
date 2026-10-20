import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';

export interface Invite {
	id: string;
	label: string | null;
	role: string;
	createdBy: string | null;
	createdAt: string;
	expiresAt: string;
	acceptedAt: string | null;
	acceptedBy: string | null;
}

interface InviteRow {
	id: string;
	token_hash: string;
	label: string | null;
	role: string;
	created_by: string | null;
	created_at: string;
	expires_at: string;
	accepted_at: string | null;
	accepted_by: string | null;
}

function toInvite(row: InviteRow): Invite {
	return {
		id: row.id,
		label: row.label,
		role: row.role,
		createdBy: row.created_by,
		createdAt: row.created_at,
		expiresAt: row.expires_at,
		acceptedAt: row.accepted_at,
		acceptedBy: row.accepted_by
	};
}

export interface NewInvite {
	/** HMAC of the raw token — the raw token is never persisted. */
	tokenHash: string;
	label?: string | null;
	role?: string;
	createdBy?: string | null;
	ttlSeconds: number;
}

export async function createInvite(db: D1Database, input: NewInvite): Promise<Invite> {
	const id = ulid();
	const now = Date.now();
	const row: InviteRow = {
		id,
		token_hash: input.tokenHash,
		label: input.label ?? null,
		role: input.role ?? 'member',
		created_by: input.createdBy ?? null,
		created_at: new Date(now).toISOString(),
		expires_at: new Date(now + input.ttlSeconds * 1000).toISOString(),
		accepted_at: null,
		accepted_by: null
	};

	await run(
		db,
		`INSERT INTO invites
			(id, token_hash, label, role, created_by, created_at, expires_at, accepted_at, accepted_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			row.id,
			row.token_hash,
			row.label,
			row.role,
			row.created_by,
			row.created_at,
			row.expires_at,
			row.accepted_at,
			row.accepted_by
		]
	);

	return toInvite(row);
}

export async function getInviteByTokenHash(
	db: D1Database,
	tokenHash: string
): Promise<Invite | null> {
	const row = await first<InviteRow>(db, 'SELECT * FROM invites WHERE token_hash = ? LIMIT 1', [
		tokenHash
	]);
	return row ? toInvite(row) : null;
}

/** True while the invite is usable: present, not yet accepted, not expired. */
export function isInviteUsable(invite: Invite | null | undefined): boolean {
	return Boolean(invite && !invite.acceptedAt && new Date(invite.expiresAt).getTime() > Date.now());
}

/** Marks an invite as used — single-use, so this is the last time it works. */
export async function acceptInvite(db: D1Database, id: string, actorId: string): Promise<void> {
	await run(db, 'UPDATE invites SET accepted_at = ?, accepted_by = ? WHERE id = ?', [
		new Date().toISOString(),
		actorId,
		id
	]);
}

export async function listInvites(db: D1Database, limit = 50): Promise<Invite[]> {
	const rows = await query<InviteRow>(
		db,
		'SELECT * FROM invites ORDER BY created_at DESC LIMIT ?',
		[limit]
	);
	return rows.map(toInvite);
}

export async function deleteInvite(db: D1Database, id: string): Promise<void> {
	await run(db, 'DELETE FROM invites WHERE id = ?', [id]);
}
