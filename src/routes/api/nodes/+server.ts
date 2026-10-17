import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { createNode, listNodes } from '$lib/server/repositories/nodes';
import { getContentType } from '$lib/content/registry';
import { nodeUrl } from '$lib/content/view';
import { derivedPaths, purgeCache } from '$lib/server/cache';
import type { NodeStatus } from '$lib/content/types';

export const prerender = false;

/** GET /api/nodes?type=&lang=&status=all|published|draft — owner listing. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

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
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

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

	const node = await createNode(db, {
		type,
		slug,
		lang: String(body.lang ?? 'en'),
		title: body.title != null ? String(body.title) : null,
		summary: body.summary != null ? String(body.summary) : null,
		bodyMd,
		status,
		publishedAt: body.publishedAt ? String(body.publishedAt) : null,
		extra: (body.extra as Record<string, unknown>) ?? {}
	});

	await purgeCache(event.url.origin, derivedPaths(nodeUrl(node), node.slug, node.lang));

	return json({ ok: true, node });
};
