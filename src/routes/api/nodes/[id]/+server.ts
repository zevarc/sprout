import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { deleteNode, getNode, updateNode } from '$lib/server/repositories/nodes';
import { nodeUrl } from '$lib/content/view';
import { derivedPaths, purgeCache } from '$lib/server/cache';
import type { NodeStatus } from '$lib/content/types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	const node = await getNode(db, event.params.id);
	if (!node) return json({ error: 'not found' }, { status: 404 });
	return json({ node });
};

/** PATCH /api/nodes/[id] — update fields and/or status (publish, archive…). */
export const PATCH: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const node = await updateNode(db, event.params.id, {
		title: body.title !== undefined ? (body.title == null ? null : String(body.title)) : undefined,
		summary:
			body.summary !== undefined ? (body.summary == null ? null : String(body.summary)) : undefined,
		bodyMd: body.bodyMd !== undefined ? String(body.bodyMd) : undefined,
		status: body.status !== undefined ? (body.status as NodeStatus) : undefined,
		slug: body.slug !== undefined ? String(body.slug) : undefined,
		extra: body.extra !== undefined ? (body.extra as Record<string, unknown>) : undefined
	});

	if (!node) return json({ error: 'not found' }, { status: 404 });
	await purgeCache(event.url.origin, derivedPaths(nodeUrl(node), node.slug, node.lang));
	return json({ ok: true, node });
};

export const DELETE: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	await deleteNode(db, event.params.id);
	await purgeCache(event.url.origin, derivedPaths());
	return json({ ok: true });
};
