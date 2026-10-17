import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { renderComment } from '$lib/server/render';
import {
	addEvent,
	countEventsSince,
	hasApprovedComment,
	listEvents,
	setEventStatus
} from '$lib/server/repositories/events';
import {
	createActor,
	getActor,
	getActorByEmailHash,
	getActorByIdentity,
	linkIdentity
} from '$lib/server/repositories/actors';
import {
	getActorFromCookie,
	getSession,
	hashEmail,
	hashIp,
	issueActorCookie
} from '$lib/server/auth';

import { site } from '$lib/site';

export const prerender = false;

const RESERVED_NAMES = new Set([site.name.toLowerCase(), 'owner', 'admin', 'administrator']);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;

interface CommentDTO {
	id: string;
	parentId: string | null;
	bodyHtml: string;
	createdAt: string;
	author: { name: string; avatarUrl: string | null; isOwner: boolean };
}

/** GET /api/events?kind=comment&targetType=post&targetId=… */
export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform);
	const kind = url.searchParams.get('kind') ?? 'comment';
	const targetType = url.searchParams.get('targetType') ?? undefined;
	const targetId = url.searchParams.get('targetId') ?? undefined;

	const events = await listEvents(db, { kind: kind as 'comment', targetType, targetId });
	const actorIds = [...new Set(events.map((e) => e.actorId).filter(Boolean))] as string[];
	const actors = await Promise.all(actorIds.map((id) => getActor(db, id)));
	const actorMap = new Map(actors.filter(Boolean).map((a) => [a!.id, a!]));

	const comments: CommentDTO[] = events.map((e) => {
		const actor = e.actorId ? actorMap.get(e.actorId) : undefined;
		return {
			id: e.id,
			parentId: e.parentId,
			bodyHtml: (e.payload?.html as string) ?? '',
			createdAt: e.createdAt,
			author: {
				name: actor?.displayName ?? 'Anonymous',
				avatarUrl: actor?.avatarUrl ?? null,
				isOwner: actor?.kind === 'owner'
			}
		};
	});

	return json({ comments });
};

/** POST /api/events — create a comment (or reaction). */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	const env = event.platform?.env;

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	// Honeypot: bots fill hidden fields.
	if (typeof body.website === 'string' && body.website.trim() !== '') {
		return json({ ok: true, id: null });
	}

	const kind = (body.kind as string) ?? 'comment';
	if (kind !== 'comment' && kind !== 'reaction') {
		return json({ error: 'unsupported kind' }, { status: 400 });
	}

	const targetType = String(body.targetType ?? '');
	const targetId = String(body.targetId ?? '');
	if (!targetType || !targetId) return json({ error: 'missing target' }, { status: 400 });

	// Resolve identity: owner session > signed anon cookie > new anonymous actor.
	const session = await getSession(event, db);
	let actorId: string | null = null;
	let isNewActor = false;

	if (session?.role === 'owner') {
		actorId = session.actorId;
	} else if (body.provider && body.providerUid) {
		const provider = String(body.provider);
		const providerUid = String(body.providerUid);
		const linked = await getActorByIdentity(db, provider, providerUid);
		if (linked) {
			actorId = linked.id;
		} else {
			const created = await createActor(db, {
				kind: 'visitor',
				displayName: String(body.name ?? 'Visitor'),
				avatarUrl: body.avatarUrl ? String(body.avatarUrl) : null
			});
			await linkIdentity(db, created.id, provider, providerUid);
			actorId = created.id;
		}
	} else {
		const cookieActor = await getActorFromCookie(event);
		if (cookieActor) actorId = cookieActor;
	}

	const name = String(body.name ?? '').trim();
	if (!actorId) {
		if (!name) return json({ error: 'name required' }, { status: 400 });
		if (RESERVED_NAMES.has(name.toLowerCase()))
			return json({ error: 'reserved name' }, { status: 400 });

		const email = String(body.email ?? '').trim();
		const emailHash = email && env?.IP_HASH_SALT ? await hashEmail(email, env.IP_HASH_SALT) : null;
		const existing = emailHash ? await getActorByEmailHash(db, emailHash) : null;
		if (existing) {
			actorId = existing.id;
		} else {
			const created = await createActor(db, {
				kind: 'anonymous',
				displayName: name,
				emailHash
			});
			actorId = created.id;
			isNewActor = true;
		}
		await issueActorCookie(event, actorId);
	}

	if (kind === 'reaction') {
		const created = await addEvent(db, {
			kind: 'reaction',
			targetType,
			targetId,
			actorId,
			payload: { emoji: String(body.emoji ?? '👍') }
		});
		await setEventStatus(db, created.id, 'approved', actorId);
		return json({ ok: true, id: created.id });
	}

	// Comment: text required.
	const text = String(body.body ?? '').trim();
	if (!text) return json({ error: 'empty comment' }, { status: 400 });
	if (text.length > 4000) return json({ error: 'too long' }, { status: 400 });

	// Rate limiting (per actor, sliding window).
	const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
	const recent = await countEventsSince(db, { actorId, kind: 'comment', since });
	if (recent >= RATE_MAX) return json({ error: 'rate limited' }, { status: 429 });

	// Spam signals.
	let ipHash: string | null = null;
	try {
		const ip = event.getClientAddress();
		if (ip && env?.IP_HASH_SALT) {
			ipHash = await hashIp(ip, env.IP_HASH_SALT, new Date().toISOString().slice(0, 10));
		}
	} catch {
		/* address unavailable */
	}

	const html = await renderComment(text);
	const created = await addEvent(db, {
		kind: 'comment',
		targetType,
		targetId,
		actorId,
		parentId: body.parentId ? String(body.parentId) : null,
		bodyMd: text,
		payload: { html, ipHash }
	});

	// Owner auto-approves; a previously-approved commenter is trusted;
	// otherwise the comment waits in the moderation queue.
	let status: 'approved' | 'pending' = 'pending';
	if (session?.role === 'owner') {
		status = 'approved';
	} else if (actorId && (await hasApprovedComment(db, actorId))) {
		status = 'approved';
	}
	await setEventStatus(db, created.id, status, actorId);

	return json({ ok: true, id: created.id, status });
};
