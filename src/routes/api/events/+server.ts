import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { renderComment } from '$lib/server/render';
import {
	addComment,
	countCommentsSince,
	hasApprovedComment,
	listComments,
	setCommentStatus
} from '$lib/server/repositories/comments';
import { addReaction, listReactions } from '$lib/server/repositories/reactions';
import {
	getPerson,
	getPersonByEmailHash,
	getPersonByIdentity,
	createPerson,
	linkIdentity
} from '$lib/server/repositories/people';
import {
	getPersonFromCookie,
	getSession,
	hashEmail,
	hashIp,
	issuePersonCookie
} from '$lib/server/auth';

import { site } from '$lib/site';
import { isCommentablePage, pageAssetId } from '$lib/content/pages';
import { ensurePageAsset } from '$lib/server/repositories/pages';

export const prerender = false;

/**
 * Turns a request target into the asset id comments hang on.
 *
 * Content targets are asset ids already. A static page is declared by route
 * (`/about`) and maps to a deterministic anchor — the same id both when reading
 * and when writing, so the two never disagree.
 */
function resolveTarget(targetType: string, rawId: string, lang: string): string | null {
	if (targetType !== 'page') return rawId;
	return isCommentablePage(rawId) ? pageAssetId(rawId, lang) : null;
}

/** Only locales the site declares — never a client-supplied label. */
function resolveLang(value: unknown): string {
	const code = String(value ?? '');
	return site.locales.some((l) => l.code === code) ? code : site.defaultLocale;
}


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

/**
 * GET /api/events?kind=comment&targetId=… — approved comments on one asset.
 * `kind=reaction` returns the reaction rows instead.
 */
export const GET: RequestHandler = async ({ url, platform }) => {
	const db = getDb(platform);
	const kind = url.searchParams.get('kind') ?? 'comment';
	const lang = resolveLang(url.searchParams.get('lang'));
	const targetId = resolveTarget(
		url.searchParams.get('targetType') ?? '',
		url.searchParams.get('targetId') ?? '',
		lang
	);
	if (!targetId) return json({ comments: [], reactions: [] });

	if (kind === 'reaction') {
		return json({ reactions: await listReactions(db, targetId) });
	}

	const comments = await listComments(db, { assetId: targetId, status: 'approved' });
	const personIds = [...new Set(comments.map((c) => c.authorId))];
	const people = await Promise.all(personIds.map((id) => getPerson(db, id)));
	const byId = new Map(people.filter(Boolean).map((p) => [p!.id, p!]));

	const out: CommentDTO[] = await Promise.all(
		comments.map(async (c) => {
			const person = byId.get(c.authorId);
			return {
				id: c.id,
				parentId: c.parentId,
				// Rendered HTML is derived, never stored.
				bodyHtml: c.bodyMd ? await renderComment(c.bodyMd) : '',
				createdAt: c.createdAt,
				author: {
					name: person?.displayName ?? 'Anonymous',
					avatarUrl: person?.avatarUrl ?? null,
					isOwner: person?.role === 'owner'
				}
			};
		})
	);

	return json({ comments: out });
};

/** POST /api/events — create a comment or a reaction. */
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

	const lang = resolveLang(body.lang);
	const targetType = String(body.targetType ?? '');
	let targetId = resolveTarget(targetType, String(body.targetId ?? ''), lang);
	if (!targetId) return json({ error: 'missing target' }, { status: 400 });
	// A page anchor appears with its first comment; until then the page simply has
	// no comments, and reads never write.
	if (targetType === 'page') targetId = await ensurePageAsset(db, { path: String(body.targetId), lang });

	// Resolve identity: owner session > signed cookie > external account > new
	// anonymous person. A person with no role is simply not a member.
	const session = await getSession(event, db);
	let personId: string | null = null;

	if (session?.role === 'owner' || session?.role === 'member') {
		personId = session.personId;
	} else if (body.provider && body.providerUid) {
		const provider = String(body.provider);
		const providerUid = String(body.providerUid);
		const linked = await getPersonByIdentity(db, provider, providerUid);
		if (linked) {
			personId = linked.id;
		} else {
			const created = await createPerson(db, {
				displayName: String(body.name ?? 'Visitor'),
				avatarUrl: body.avatarUrl ? String(body.avatarUrl) : null
			});
			await linkIdentity(db, created.id, provider, providerUid);
			personId = created.id;
		}
	} else {
		const cookiePerson = await getPersonFromCookie(event);
		if (cookiePerson) personId = cookiePerson;
	}

	const name = String(body.name ?? '').trim();
	if (!personId) {
		if (!name) return json({ error: 'name required' }, { status: 400 });
		if (RESERVED_NAMES.has(name.toLowerCase()))
			return json({ error: 'reserved name' }, { status: 400 });

		const email = String(body.email ?? '').trim();
		const emailHash = email && env?.IP_HASH_SALT ? await hashEmail(email, env.IP_HASH_SALT) : null;
		const existing = emailHash ? await getPersonByEmailHash(db, emailHash) : null;
		if (existing) {
			personId = existing.id;
		} else {
			const created = await createPerson(db, { displayName: name, emailHash });
			personId = created.id;
		}
		await issuePersonCookie(event, personId);
	}

	if (kind === 'reaction') {
		await addReaction(db, targetId, personId, String(body.emoji ?? '👍'));
		return json({ ok: true });
	}

	// Comment: text required.
	const text = String(body.body ?? '').trim();
	if (!text) return json({ error: 'empty comment' }, { status: 400 });
	if (text.length > 4000) return json({ error: 'too long' }, { status: 400 });

	// Rate limiting (per person, sliding window).
	const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
	const recent = await countCommentsSince(db, { authorId: personId, since });
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

	const created = await addComment(db, {
		assetId: targetId,
		parentId: body.parentId ? String(body.parentId) : null,
		authorId: personId,
		bodyMd: text,
		// Structured metadata only — rendered HTML is derived on read.
		payload: ipHash ? { ipHash } : null
	});

	// Owner and members auto-approve; a previously-approved commenter is trusted;
	// otherwise the comment waits in the moderation queue.
	let status: 'approved' | 'pending' = 'pending';
	if (session?.role === 'owner' || session?.role === 'member') {
		status = 'approved';
	} else if (await hasApprovedComment(db, personId)) {
		status = 'approved';
	}
	await setCommentStatus(db, created.id, status, personId);

	return json({ ok: true, id: created.id, status });
};
