import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { requireOwner } from '$lib/server/auth';
import { listEvents, setEventStatus } from '$lib/server/repositories/events';
import type { EventModeration } from '$lib/content/types';

export const prerender = false;

const VALID: EventModeration[] = ['pending', 'approved', 'spam', 'deleted'];

/** GET /api/admin/moderate?status=pending — moderation queue. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	await requireOwner(event, db);
	const status = (event.url.searchParams.get('status') as EventModeration) ?? 'pending';
	const events = await listEvents(db, { kind: 'comment', includeUnapproved: true, limit: 200 });
	return json({ events: events.filter((e) => (e.status ?? 'approved') === status) });
};

/** POST /api/admin/moderate { eventId, status } — append a moderation status. */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	const session = await requireOwner(event, db);

	let body: { eventId?: string; status?: string };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const eventId = String(body.eventId ?? '');
	const status = body.status as EventModeration;
	if (!eventId || !VALID.includes(status)) {
		return json({ error: 'invalid input' }, { status: 400 });
	}

	await setEventStatus(db, eventId, status, session.actorId);
	return json({ ok: true });
};
