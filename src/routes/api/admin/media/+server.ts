import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isEditor } from '$lib/server/auth';
import { invalidateAll } from '$lib/server/cache';
import {
	deleteMedia,
	getMedia,
	insertMedia,
	listMediaForNode,
	updateMedia
} from '$lib/server/repositories/media';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

const EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/svg+xml': 'svg'
};

function toHex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /api/admin/media (multipart: file, nodeId?, position?, alt?)
 * Stores the binary in R2 under a content-addressed key and records metadata.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const bucket = event.platform?.env?.MEDIA;
	if (!bucket) return json({ error: 'MEDIA binding missing' }, { status: 500 });

	const form = await event.request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) return json({ error: 'file required' }, { status: 400 });
	if (file.size > MAX_BYTES) return json({ error: 'file too large' }, { status: 413 });
	if (!ALLOWED.has(file.type)) return json({ error: 'unsupported type' }, { status: 415 });

	const buffer = await file.arrayBuffer();
	const sha256 = toHex(await crypto.subtle.digest('SHA-256', buffer));
	const ext = EXT[file.type] ?? 'bin';
	const key = `${sha256}.${ext}`;

	await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } });

	const nodeId = form.get('nodeId') ? String(form.get('nodeId')) : null;
	const position = Number(form.get('position') ?? 0) || 0;
	const alt = form.get('alt') ? String(form.get('alt')) : null;

	// `record=0` stores the binary only — used when restoring an export whose
	// media metadata is already present in media.jsonl.
	if (form.get('record') !== '0') {
		await insertMedia(db, { nodeId, r2Key: key, alt, position, sha256 });
		await invalidateAll(event.url.origin);
	}

	return json({ ok: true, key, url: `/media/${key}`, sha256 });
};

/** GET /api/admin/media?nodeId=… — media rows attached to a node. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const nodeId = event.url.searchParams.get('nodeId');
	if (!nodeId) return json({ error: 'nodeId required' }, { status: 400 });

	const rows = await listMediaForNode(db, nodeId);
	return json({
		media: rows.map((m) => ({
			id: m.id,
			kind: m.kind,
			alt: m.alt,
			position: m.position,
			url: `/media/${m.r2Key}`
		}))
	});
};

/** PATCH /api/admin/media — { id, alt?, position? }. */
export const PATCH: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const id = String(body.id ?? '');
	if (!id) return json({ error: 'id required' }, { status: 400 });

	const alt = body.alt === undefined ? undefined : body.alt == null ? null : String(body.alt);
	const position = body.position === undefined ? undefined : Number(body.position) || 0;
	if (alt === undefined && position === undefined) {
		return json({ error: 'nothing to update' }, { status: 400 });
	}

	await updateMedia(db, id, { alt, position });
	await invalidateAll(event.url.origin);
	return json({ ok: true });
};

/** DELETE /api/admin/media?id=… — drop the row and the stored object. */
export const DELETE: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const id = event.url.searchParams.get('id');
	if (!id) return json({ error: 'id required' }, { status: 400 });

	const row = await getMedia(db, id);
	if (!row) return json({ error: 'not found' }, { status: 404 });

	const bucket = event.platform?.env?.MEDIA;
	if (bucket) await bucket.delete(row.r2Key);
	await deleteMedia(db, id);
	await invalidateAll(event.url.origin);
	return json({ ok: true });
};
