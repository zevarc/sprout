import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isEditor } from '$lib/server/auth';
import { deleteNode, getNode, getNodeBySlug, updateNode } from '$lib/server/repositories/nodes';
import { getContentType } from '$lib/content/registry';
import { nodeUrl } from '$lib/content/view';
import { invalidateAll, invalidateNode } from '$lib/server/cache';
import { normalizeTags, validateFields } from '$lib/engine/fields';
import type { NodeStatus, NodeVisibility } from '$lib/content/types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	const node = await getNode(db, event.params.id);
	if (!node) return json({ error: 'not found' }, { status: 404 });
	return json({ node });
};

/** PATCH /api/nodes/[id] — update fields and/or status (publish, archive…). */
export const PATCH: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const existing = await getNode(db, event.params.id);
	if (!existing) return json({ error: 'not found' }, { status: 404 });

	if (
		body.status !== undefined &&
		!['draft', 'scheduled', 'published', 'archived'].includes(String(body.status))
	) {
		return json({ error: 'invalid status' }, { status: 400 });
	}
	if (
		body.visibility !== undefined &&
		!['public', 'private'].includes(String(body.visibility))
	) {
		return json({ error: 'invalid visibility' }, { status: 400 });
	}
	const nextSlug = body.slug !== undefined ? String(body.slug).trim() : undefined;
	if (body.slug !== undefined && !nextSlug) {
		return json({ error: 'slug required' }, { status: 400 });
	}

	// Slugs are unique per (type, lang) — report a conflict rather than a 500.
	if (nextSlug !== undefined || body.lang !== undefined) {
		const clash = await getNodeBySlug(
			db,
			existing.type,
			nextSlug ?? existing.slug,
			body.lang !== undefined ? String(body.lang) : existing.lang
		);
		if (clash && clash.id !== existing.id) {
			return json({ error: 'slug already exists' }, { status: 409 });
		}
	}

	// Declared fields are validated here — the single write boundary. Omit
	// `fields` to leave them untouched; send `{}` to clear them.
	let fields: Record<string, unknown> | undefined;
	if (body.fields !== undefined) {
		const definition = getContentType(existing.type);
		const validated = validateFields(definition?.fields ?? [], body.fields);
		if (!validated.ok) {
			return json({ error: 'invalid fields', details: validated.errors }, { status: 400 });
		}
		fields = validated.value;
	}

	const node = await updateNode(db, event.params.id, {
		title: body.title !== undefined ? (body.title == null ? null : String(body.title)) : undefined,
		summary:
			body.summary !== undefined ? (body.summary == null ? null : String(body.summary)) : undefined,
		bodyMd: body.bodyMd !== undefined ? String(body.bodyMd) : undefined,
		status: body.status !== undefined ? (body.status as NodeStatus) : undefined,
		slug: nextSlug,
		lang: body.lang !== undefined ? String(body.lang) : undefined,
		publishedAt:
			body.publishedAt !== undefined
				? body.publishedAt == null
					? null
					: String(body.publishedAt)
				: undefined,
		occurredAt:
			body.occurredAt !== undefined
				? body.occurredAt == null
					? null
					: String(body.occurredAt)
				: undefined,
		visibility:
			body.visibility !== undefined ? (body.visibility as NodeVisibility) : undefined,
		featured: body.featured !== undefined ? body.featured === true : undefined,
		coverMediaId:
			body.coverMediaId !== undefined
				? body.coverMediaId == null || body.coverMediaId === ''
					? null
					: String(body.coverMediaId)
				: undefined,
		fields,
		tags: body.tags !== undefined ? normalizeTags(body.tags) : undefined
	});

	if (!node) return json({ error: 'not found' }, { status: 404 });
	await invalidateNode(event.url.origin, nodeUrl(node), node.slug);
	return json({ ok: true, node });
};

export const DELETE: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	await deleteNode(db, event.params.id);
	await invalidateAll(event.url.origin);
	return json({ ok: true });
};
