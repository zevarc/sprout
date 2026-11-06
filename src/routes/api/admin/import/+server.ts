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
import type { ContentNode, NewAsset } from '$lib/content/types';

/** The asset's current cover object key (`<sha256>.<ext>`), if it has one. */
function coverKey(node: ContentNode): string | null {
	if (!node.coverMediaId) return null;
	return node.media?.find((m) => m.id === node.coverMediaId)?.r2Key ?? null;
}

/**
 * True when re-importing this node would write exactly what is already stored.
 *
 * A migration is often re-run: a new environment, a retry, a typo fix in one file.
 * Letting every run rewrite every row re-dates the whole site: `updated_at`
 * feeds `dateModified` and sitemap `<lastmod>`, so a no-op import would claim
 * that all 59 posts changed today — a freshness signal that stops meaning
 * anything.
 */
function sameContent(
	existing: ContentNode,
	input: NewAsset,
	tags: string[],
	fields: Record<string, unknown>
): boolean {
	const stamp = (value: string | null | undefined) =>
		value ? new Date(value).toISOString() : null;
	const sorted = (value: Record<string, unknown>) =>
		JSON.stringify(
			Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
		);
	const sameTags = [...(existing.tags ?? [])].sort().join('\u0000') === [...tags].sort().join('\u0000');

	return (
		(existing.title ?? '') === (input.title ?? '') &&
		(existing.summary ?? '') === (input.summary ?? '') &&
		existing.bodyMd === input.bodyMd &&
		existing.status === (input.status ?? existing.status) &&
		existing.visibility === (input.visibility ?? existing.visibility) &&
		stamp(existing.publishedAt) === stamp(input.publishedAt ?? existing.publishedAt) &&
		stamp(existing.occurredAt) === stamp(input.occurredAt ?? existing.occurredAt) &&
		sameTags &&
		sorted(existing.fields ?? {}) === sorted(fields)
	);
}

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
	/** Aligned with `ids`: the cover object key the node ended up with. */
	const covers: (string | null)[] = [];
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
		const tags = normalizeTags(input.tags);

		if (existing) {
			if (payload.replace) await deleteAsset(db, existing.id);
			else {
				if (!sameContent(existing, input, tags, validated.value)) {
					await updateAsset(db, existing.id, {
						...input,
						// Grouping is expressed through `assets.group_id` (and the link
						// endpoint); an import must not re-key it on every run.
						groupId: existing.groupId,
						fields: validated.value,
						tags
					});
				}
				imported.push(existing.id);
				covers.push(coverKey(existing));
				continue;
			}
		}

		const created = await createAsset(db, {
			...input,
			lang,
			authorId: input.authorId ?? owner.id,
			fields: validated.value,
			tags
		});
		imported.push(created.id);
		covers.push(null);
	}

	await invalidateAll(event.url.origin);
	// `covers` lets a client skip re-uploading a cover it can see is already the
	// same object (media is content-addressed, so the key starts with the hash).
	return json({ ok: true, count: imported.length, ids: imported, covers });
};
