import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isEditor } from '$lib/server/auth';
import {
	deleteAsset,
	getAsset,
	getAssetBySlug,
	updateAsset
} from '$lib/server/repositories/assets';
import { nodeUrl } from '$lib/content/view';
import { invalidateAll, invalidateNode } from '$lib/server/cache';
import { validateFields, normalizeTags } from '$lib/engine/fields';
import { getContentType } from '$lib/content/registry';
import type { AssetStatus, Visibility } from '$lib/content/types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });
	const node = await getAsset(db, event.params.id);
	if (!node) return json({ error: 'not found' }, { status: 404 });
	return json({ node });
};

/** PATCH /api/nodes/[id] — update content, fields, tags and/or state. */
export const PATCH: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const existing = await getAsset(db, event.params.id);
	if (!existing) return json({ error: 'not found' }, { status: 404 });

	if (
		body.status !== undefined &&
		!['draft', 'published', 'archived'].includes(String(body.status))
	) {
		return json({ error: 'invalid status' }, { status: 400 });
	}
	if (body.visibility !== undefined && !['public', 'private'].includes(String(body.visibility))) {
		return json({ error: 'invalid visibility' }, { status: 400 });
	}
	const nextSlug = body.slug !== undefined ? String(body.slug).trim() : undefined;
	if (body.slug !== undefined && !nextSlug) {
		return json({ error: 'slug required' }, { status: 400 });
	}

	// Slugs are unique per (kind, lang) — report a conflict rather than a 500.
	if (nextSlug !== undefined || body.lang !== undefined) {
		const clash = await getAssetBySlug(
			db,
			existing.type,
			nextSlug ?? existing.slug,
			body.lang !== undefined ? String(body.lang) : existing.lang
		);
		if (clash && clash.id !== existing.id) {
			return json({ error: 'slug already exists' }, { status: 409 });
		}
	}

	// Declared fields: validated against the kind's declaration, then written as
	// columns on the kind's table.
	let fields: Record<string, unknown> | undefined;
	if (body.fields !== undefined) {
		const validated = validateFields(getContentType(existing.type)?.fields ?? [], body.fields);
		if (!validated.ok) {
			return json({ error: 'invalid fields', details: validated.errors }, { status: 400 });
		}
		fields = validated.value;
	}

	const node = await updateAsset(db, event.params.id, {
		title: body.title !== undefined ? (body.title == null ? null : String(body.title)) : undefined,
		summary:
			body.summary !== undefined ? (body.summary == null ? null : String(body.summary)) : undefined,
		bodyMd: body.bodyMd !== undefined ? String(body.bodyMd) : undefined,
		status: body.status !== undefined ? (body.status as AssetStatus) : undefined,
		slug: nextSlug,
		lang: body.lang !== undefined ? String(body.lang) : undefined,
		groupId:
			body.groupId !== undefined ? (body.groupId == null ? null : String(body.groupId)) : undefined,
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
		visibility: body.visibility !== undefined ? (body.visibility as Visibility) : undefined,
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
	await deleteAsset(db, event.params.id);
	await invalidateAll(event.url.origin);
	return json({ ok: true });
};
