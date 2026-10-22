import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getSession, isEditor } from '$lib/server/auth';
import { createAsset, getAssetBySlug, listAssets, uniqueSlug } from '$lib/server/repositories/assets';
import { ensureOwner } from '$lib/server/repositories/people';
import { getContentType } from '$lib/content/registry';
import { slugify } from '$lib/reading';
import { nodeUrl } from '$lib/content/view';
import { invalidateNode } from '$lib/server/cache';
import { site } from '$lib/site';
import { content } from '$lib/engine/registry';
import { normalizeTags, validateFields } from '$lib/engine/fields';
import type { AssetStatus, Visibility } from '$lib/content/types';

export const prerender = false;

/** GET /api/nodes?type=&lang=&status=all|published|draft — editor listing. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isEditor(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const nodes = await listAssets(db, {
		type: event.url.searchParams.get('type') ?? undefined,
		lang: event.url.searchParams.get('lang') ?? undefined,
		status: (event.url.searchParams.get('status') as AssetStatus | 'all') ?? 'all',
		limit: Number(event.url.searchParams.get('limit') ?? 100)
	});
	return json({ nodes });
};

/** POST /api/nodes — create an asset (draft or published). */
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
	const definition = getContentType(type);
	if (!definition) return json({ error: 'unknown type' }, { status: 400 });

	const lang = String(body.lang ?? site.defaultLocale);

	// A slug is optional. Filling in a URL identifier by hand is a typing tax,
	// especially for micro-posts, so derive one: the title when there is one,
	// otherwise the date. `uniqueSlug` appends -2, -3, … within (kind, lang).
	let slug = String(body.slug ?? '').trim();
	if (!slug) {
		const title = body.title != null ? String(body.title).trim() : '';
		const day = String(body.publishedAt ?? body.occurredAt ?? new Date().toISOString()).slice(0, 10);
		const base = (title ? slugify(title) : '') || day || 'entry';
		slug = await uniqueSlug(db, type, lang, base);
	}

	const bodyMd = String(body.bodyMd ?? '');
	const status = (body.status as AssetStatus) ?? 'draft';
	if (!['draft', 'published', 'archived'].includes(status)) {
		return json({ error: 'invalid status' }, { status: 400 });
	}

	// Declared fields are validated here — the single write boundary. In v4 each
	// declared field is a real column on the kind's table.
	const fields = validateFields(definition.fields, body.fields ?? {});
	if (!fields.ok) {
		return json({ error: 'invalid fields', details: fields.errors }, { status: 400 });
	}

	// Slugs are unique per (kind, lang) — a clear conflict beats a raw 500.
	if (await getAssetBySlug(db, type, slug, lang)) {
		return json({ error: 'slug already exists' }, { status: 409 });
	}

	const visibility: Visibility =
		body.visibility === 'public' || body.visibility === 'private'
			? body.visibility
			: (content?.defaultVisibility ?? 'public');

	// Every asset has an author. A machine request (Bearer token) has no session,
	// so it records as the site owner.
	const authorId = session?.personId ?? (await ensureOwner(db)).id;

	const node = await createAsset(db, {
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
		authorId,
		fields: fields.value,
		tags: normalizeTags(body.tags)
	});

	await invalidateNode(event.url.origin, nodeUrl(node), node.slug);

	return json({ ok: true, node });
};
