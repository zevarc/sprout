import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import {
	createAsset,
	deleteAsset,
	getAssetBySlug,
	updateAsset
} from '$lib/server/repositories/assets';
import { ensureOwner } from '$lib/server/repositories/people';
import { getContentType } from '$lib/content/registry';
import { validateFields, normalizeTags } from '$lib/engine/fields';
import { invalidateAll } from '$lib/server/cache';
import { site } from '$lib/site';
import type { NewAsset } from '$lib/content/types';

export const prerender = false;

/**
 * Bulk import used by content migration. Accepts structured assets (markdown body
 * only); rendering happens here through the normal pipeline.
 *
 * Idempotency is keyed on the human identity `(kind, slug, lang)` — asset ids are
 * generated ULIDs, so callers must not supply them. Grouping (translations) is
 * carried by `groupId` so callers may batch freely.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let payload: { nodes?: NewAsset[]; replace?: boolean };
	try {
		payload = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const nodes = payload.nodes ?? [];
	const imported: string[] = [];
	const owner = await ensureOwner(db);

	for (const input of nodes) {
		if (!input.type || !input.slug) continue;
		const definition = getContentType(input.type);
		if (!definition) {
			return json({ error: `unknown type: ${input.type}` }, { status: 400 });
		}
		if (input.status && !['draft', 'published', 'archived'].includes(input.status)) {
			return json({ error: 'invalid status' }, { status: 400 });
		}
		if (input.visibility && !['public', 'private'].includes(input.visibility)) {
			return json({ error: 'invalid visibility' }, { status: 400 });
		}

		// The same write boundary as the API: a migration may not smuggle in
		// undeclared fields or values outside a select's options.
		const validated = validateFields(definition.fields, input.fields ?? {});
		if (!validated.ok) {
			return json({ error: 'invalid fields', details: validated.errors }, { status: 400 });
		}

		const lang = input.lang ?? site.defaultLocale;
		const existing = await getAssetBySlug(db, input.type, input.slug, lang);

		if (existing) {
			if (payload.replace) await deleteAsset(db, existing.id);
			else {
				await updateAsset(db, existing.id, {
					...input,
					fields: validated.value,
					tags: normalizeTags(input.tags)
				});
				imported.push(existing.id);
				continue;
			}
		}

		const created = await createAsset(db, {
			...input,
			lang,
			authorId: input.authorId ?? owner.id,
			fields: validated.value,
			tags: normalizeTags(input.tags)
		});
		imported.push(created.id);
	}

	await invalidateAll(event.url.origin);
	return json({ ok: true, count: imported.length, ids: imported });
};
