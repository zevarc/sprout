import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { hashToken, issueMemberSession } from '$lib/server/auth';
import { createActor } from '$lib/server/repositories/actors';
import { acceptInvite, getInviteByTokenHash, isInviteUsable } from '$lib/server/repositories/invites';
import { hasFeature } from '$lib/engine/features';

export const prerender = false;

function disabled() {
	return !hasFeature('members');
}

/** GET /api/auth/invite?token=… — previews an invite (label only, never the token). */
export const GET: RequestHandler = async ({ url, platform }) => {
	if (disabled()) return json({ valid: false });

	const secret = platform?.env?.SESSION_SECRET;
	const token = url.searchParams.get('token') ?? '';
	if (!secret || !token) return json({ valid: false });

	const db = getDb(platform);
	const invite = await getInviteByTokenHash(db, await hashToken(secret, token));
	const valid = isInviteUsable(invite);
	return json({ valid, label: valid ? invite?.label : null });
};

/** POST /api/auth/invite — accepts an invite: creates the member and signs in. */
export const POST: RequestHandler = async (event) => {
	if (disabled()) return json({ error: 'not found' }, { status: 404 });

	const secret = event.platform?.env?.SESSION_SECRET;
	if (!secret) return json({ error: 'server not configured' }, { status: 500 });

	let token = '';
	try {
		token = String((await event.request.json())?.token ?? '');
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}
	if (!token) return json({ error: 'token required' }, { status: 400 });

	const db = getDb(event.platform);
	const invite = await getInviteByTokenHash(db, await hashToken(secret, token));
	if (!invite || !isInviteUsable(invite)) {
		return json({ error: 'invalid or expired invite' }, { status: 400 });
	}

	const actor = await createActor(db, {
		kind: 'member',
		displayName: invite.label ?? 'Member',
		handle: `member-${invite.id}`
	});
	await acceptInvite(db, invite.id, actor.id);

	const ok = await issueMemberSession(event, db, actor.id);
	if (!ok) return json({ error: 'server not configured' }, { status: 500 });

	return json({ ok: true, role: 'member', name: actor.displayName });
};
