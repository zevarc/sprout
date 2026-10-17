import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, run } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { ulid } from '$lib/server/id';

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
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

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
		await run(
			db,
			`INSERT OR REPLACE INTO media (id, node_id, r2_key, kind, width, height, alt, position, sha256)
			 VALUES (?, ?, ?, 'image', NULL, NULL, ?, ?, ?)`,
			[ulid(), nodeId, key, alt, position, sha256]
		);
	}

	return json({ ok: true, key, url: `/media/${key}`, sha256 });
};
