import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSession, isAdmin } from '$lib/server/auth';
import { listComments, setCommentStatus } from '$lib/server/repositories/comments';
import type { CommentStatus } from '$lib/content/types';

export const prerender = false;

const VALID: CommentStatus[] = ['pending', 'approved', 'spam', 'deleted'];

/** GET /api/admin/moderate?status=pending — the moderation queue. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const status = (event.url.searchParams.get('status') as CommentStatus) ?? 'pending';
	if (!VALID.includes(status)) return json({ error: 'invalid status' }, { status: 400 });

	// Filtering happens in SQL: a page never loses comments because unapproved
	// ones consumed the limit.
	const comments = await listComments(db, { status, includeAll: true, limit: 200 });
	return json({ events: comments, comments });
};

/** POST /api/admin/moderate { id, status } — set a comment's moderation state. */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const id = String(body.id ?? body.eventId ?? '');
	const status = String(body.status ?? '') as CommentStatus;
	if (!id) return json({ error: 'id required' }, { status: 400 });
	if (!VALID.includes(status)) return json({ error: 'invalid status' }, { status: 400 });

	const session = await getSession(event, db);
	await setCommentStatus(db, id, status, session?.personId ?? null);
	return json({ ok: true });
};
