import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSession, isAdmin } from '$lib/server/auth';
import { getContentType } from '$lib/content/registry';
import {
	approveApplication,
	hasFriendApplications,
	listApplications,
	setApplicationStatus,
	type FriendApplicationStatus
} from '$lib/server/repositories/friendApplications';
import { ensureOwner } from '$lib/server/repositories/people';

export const prerender = false;

const STATUSES: FriendApplicationStatus[] = ['pending', 'approved', 'rejected', 'spam'];

/** GET /api/admin/friends[?status=pending|approved|rejected|spam] — the queue. */
export const GET: RequestHandler = async (event) => {
	if (!getContentType('friend')) return json({ error: 'not found' }, { status: 404 });

	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	if (!(await hasFriendApplications(db))) return json({ error: 'not found' }, { status: 404 });

	const raw = event.url.searchParams.get('status');
	const status = raw && STATUSES.includes(raw as FriendApplicationStatus)
		? (raw as FriendApplicationStatus)
		: 'pending';
	return json({ applications: await listApplications(db, { status }) });
};

/**
 * POST /api/admin/friends { id, action } — approve, reject or mark spam.
 * Approval is the only action that creates content; see `approveApplication`.
 */
export const POST: RequestHandler = async (event) => {
	if (!getContentType('friend')) return json({ error: 'not found' }, { status: 404 });

	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const id = String(body.id ?? '');
	const action = String(body.action ?? '');
	if (!id) return json({ error: 'id required' }, { status: 400 });
	if (!['approve', 'reject', 'spam'].includes(action)) {
		return json({ error: 'invalid action' }, { status: 400 });
	}

	const session = await getSession(event, db);
	// A machine request (Bearer token) has no session, so the owner is recorded —
	// the same rule `POST /api/nodes` follows.
	const by = session?.personId ?? (await ensureOwner(db)).id;

	if (action === 'approve') {
		const result = await approveApplication(db, id, by);
		if (!result.ok) return json({ error: result.reason }, { status: 409 });
		return json({ ok: true, assetId: result.assetId });
	}

	await setApplicationStatus(db, id, action as 'rejected' | 'spam', by);
	return json({ ok: true });
};
