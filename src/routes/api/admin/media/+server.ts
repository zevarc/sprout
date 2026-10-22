import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isEditor } from '$lib/server/auth';
import { invalidateAll } from '$lib/server/cache';
import { getAsset } from '$lib/server/repositories/assets';
import {
	bindMedia,
	deleteMediaObject,
	getMediaObject,
	listMediaForAsset,
	mediaInUse,
	mediaVisibility,
	recordMediaObject,
	unbindMedia,
	updateBinding,
	type Binding
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
 * A key must have a single audience (§4.10). When the target asset's visibility
 * differs from the object's current one, copy the object under its own key.
 */
async function objectForAudience(
	db: ReturnType<typeof getDb>,
	bucket: NonNullable<App.Platform['env']['MEDIA']> | undefined,
	objectId: string,
	target: 'public' | 'private'
): Promise<string> {
	const object = await getMediaObject(db, objectId);
	if (!object) throw new Error('media object not found');
	const visibility = await mediaVisibility(db, object.r2Key);
	if (!visibility.attached) return objectId;
	if (visibility.public === (target === 'public')) return objectId;
	if (!bucket) throw new Error('MEDIA binding missing');

	const source = await bucket.get(object.r2Key);
	if (!source) throw new Error('stored object missing');
	const ext = object.r2Key.split('.').pop() ?? 'bin';
	const key = `${object.sha256 ?? toHex(await crypto.subtle.digest('SHA-256', new Uint8Array()))}.${target}.${ext}`;
	await bucket.put(key, await new Response(source.body).arrayBuffer(), {
		httpMetadata: { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` }
	});
	return recordMediaObject(db, { r2Key: key, kind: object.kind, sha256: object.sha256 });
}

/**
 * POST /api/admin/media (multipart: file, assetId?, position?, alt?, role?)
 * Stores the binary under a content-addressed key and binds it to the asset.
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
	const objectId = await recordMediaObject(db, { r2Key: key, kind: 'image', sha256 });

	const assetId = form.get('assetId') ? String(form.get('assetId')) : null;
	const position = Number(form.get('position') ?? 0) || 0;
	const alt = form.get('alt') ? String(form.get('alt')) : null;
	const role = form.get('role') === 'cover' ? 'cover' : 'body';

	// `record=0` stores the binary only — used when restoring an export whose
	// media metadata is already present.
	if (form.get('record') !== '0' && assetId) {
		const asset = await getAsset(db, assetId);
		if (!asset) return json({ error: 'asset not found' }, { status: 404 });
		const targetId = await objectForAudience(db, bucket, objectId, asset.visibility);
		await bindMedia(db, assetId, targetId, { position, alt, role });
		await invalidateAll(event.url.origin);
		return json({ ok: true, id: targetId, url: `/media/${key}`, sha256 });
	}

	return json({ ok: true, id: objectId, url: `/media/${key}`, sha256 });
};

/** GET /api/admin/media?assetId=… — the media bound to an asset. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const assetId = event.url.searchParams.get('assetId');
	if (!assetId) return json({ error: 'assetId required' }, { status: 400 });

	const rows = await listMediaForAsset(db, assetId);
	return json({
		media: rows.map((m) => ({
			id: m.id,
			kind: m.kind,
			alt: m.alt,
			position: m.position,
			role: m.role,
			url: `/media/${m.r2Key}`
		}))
	});
};

/** PATCH /api/admin/media — { assetId, id, alt?, position?, role? }. */
export const PATCH: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const assetId = String(body.assetId ?? '');
	const mediaId = String(body.id ?? '');
	if (!assetId || !mediaId) return json({ error: 'assetId and id required' }, { status: 400 });

	const patch: Binding = {};
	if (body.alt !== undefined) patch.alt = body.alt == null ? null : String(body.alt);
	if (body.position !== undefined) patch.position = Number(body.position) || 0;
	if (body.role !== undefined) {
		if (body.role !== 'body' && body.role !== 'cover') {
			return json({ error: 'invalid role' }, { status: 400 });
		}
		patch.role = body.role;
	}
	if (Object.keys(patch).length === 0) return json({ error: 'nothing to update' }, { status: 400 });

	await updateBinding(db, assetId, mediaId, patch);
	await invalidateAll(event.url.origin);
	return json({ ok: true });
};

/**
 * DELETE /api/admin/media?assetId=…&id=… — unbind one use, then collect the object
 * if nothing references it any more. A shared object is never deleted while
 * another asset still uses it.
 */
export const DELETE: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const assetId = event.url.searchParams.get('assetId');
	const id = event.url.searchParams.get('id');
	if (!assetId || !id) return json({ error: 'assetId and id required' }, { status: 400 });

	const object = await getMediaObject(db, id);
	if (!object) return json({ error: 'not found' }, { status: 404 });

	await unbindMedia(db, assetId, id);
	if (!(await mediaInUse(db, id))) {
		const bucket = event.platform?.env?.MEDIA;
		if (bucket) await bucket.delete(object.r2Key);
		await deleteMediaObject(db, id);
	}

	await invalidateAll(event.url.origin);
	return json({ ok: true });
};
