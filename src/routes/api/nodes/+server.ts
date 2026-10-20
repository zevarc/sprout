import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSession, isEditor } from '$lib/server/auth';
import { createNode, getNodeBySlug, listNodes } from '$lib/server/repositories/nodes';
import { getContentType } from '$lib/content/registry';
import { nodeUrl } from '$lib/content/view';
import { invalidateNode } from '$lib/server/cache';
import { site } from '$lib/site';
import { content } from '$lib/engine/registry';
import type { NodeStatus, NodeVisibility } from '$lib/content/types';

export const prerender = false;

/** GET /api/nodes?type=&lang=&status=all|published|draft — editor listing. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const nodes = await listNodes(db, {
		type: event.url.searchParams.get('type') ?? undefined,
		lang: event.url.searchParams.get('lang') ?? undefined,
		status: (event.url.searchParams.get('status') as NodeStatus | 'all') ?? 'all',
		limit: Number(event.url.searchParams.get('limit') ?? 100)
	});
	return json({ nodes });
};

/** POST /api/nodes — create a node (draft or published). */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	const session = await getSession(event, db);

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const type = String(body.type ?? '');
	if (!getContentType(type)) return json({ error: 'unknown type' }, { status: 400 });

	const slug = String(body.slug ?? '').trim();
	if (!slug) return json({ error: 'slug required' }, { status: 400 });

	const bodyMd = String(body.bodyMd ?? '');
	const status = (body.status as NodeStatus) ?? 'draft';
	if (!['draft', 'published', 'archived', 'scheduled'].includes(status)) {
		return json({ error: 'invalid status' }, { status: 400 });
	}

	// Slugs are unique per (type, lang) — a clear conflict beats a raw 500.
	const lang = String(body.lang ?? site.defaultLocale);
	if (await getNodeBySlug(db, type, slug, lang)) {
		return json({ error: 'slug already exists' }, { status: 409 });
	}

	const visibility: NodeVisibility =
		body.visibility === 'public' || body.visibility === 'private'
			? body.visibility
			: (content?.defaultVisibility ?? 'public');

	const node = await createNode(db, {
		type,
		slug,
		lang,
		title: body.title != null ? String(body.title) : null,
		summary: body.summary != null ? String(body.summary) : null,
		bodyMd,
		status,
		publishedAt: body.publishedAt ? String(body.publishedAt) : null,
		occurredAt: body.occurredAt ? String(body.occurredAt) : null,
		visibility,
		authorActorId: session?.actorId ?? null,
		extra: (body.extra as Record<string, unknown>) ?? {}
	});

	await invalidateNode(event.url.origin, nodeUrl(node), node.slug);

	return json({ ok: true, node });
};
