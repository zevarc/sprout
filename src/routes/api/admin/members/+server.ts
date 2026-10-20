import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { listMembers } from '$lib/server/repositories/actors';
import { listInvites } from '$lib/server/repositories/invites';
import { hasFeature } from '$lib/engine/features';

export const prerender = false;

/** GET /api/admin/members — members plus invite links (owner only). */
export const GET: RequestHandler = async (event) => {
	if (!hasFeature('members')) return json({ error: 'not found' }, { status: 404 });

	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const [members, invites] = await Promise.all([listMembers(db), listInvites(db)]);

	return json({
		members: members.map((m) => ({
			id: m.id,
			name: m.displayName ?? m.handle ?? m.id,
			createdAt: m.createdAt
		})),
		invites: invites.map((i) => ({
			id: i.id,
			label: i.label,
			createdAt: i.createdAt,
			expiresAt: i.expiresAt,
			acceptedAt: i.acceptedAt
		}))
	});
};
