import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSession, hashToken, isAdmin, randomToken } from '$lib/server/auth';
import { createInvite } from '$lib/server/repositories/invites';
import { hasFeature } from '$lib/engine/features';

export const prerender = false;

const DAY = 60 * 60 * 24;

/** POST /api/admin/members/invites — mints a single-use invite link (owner only). */
export const POST: RequestHandler = async (event) => {
	if (!hasFeature('members')) return json({ error: 'not found' }, { status: 404 });

	const secret = event.platform?.env?.SESSION_SECRET;
	if (!secret) return json({ error: 'server not configured' }, { status: 500 });

	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	const session = await getSession(event, db);

	let body: Record<string, unknown> = {};
	try {
		body = await event.request.json();
	} catch {
		/* an empty body is fine — everything is optional */
	}

	const label = body.label ? String(body.label).slice(0, 40) : null;
	const days = Number(body.ttlDays ?? 14);
	const ttlSeconds = Math.min(Math.max(Number.isFinite(days) ? days : 14, 1), 90) * DAY;

	// Only the hash is stored; the raw token is returned once, here.
	const token = randomToken();
	const invite = await createInvite(db, {
		tokenHash: await hashToken(secret, token),
		label,
		createdBy: session?.actorId ?? null,
		ttlSeconds
	});

	return json({
		ok: true,
		id: invite.id,
		label: invite.label,
		url: `/invite/${token}`,
		expiresAt: invite.expiresAt
	});
};
