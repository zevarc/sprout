import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { createNode, getNodeBySlug, updateNode, deleteNode } from '$lib/server/repositories/nodes';
import { getContentType } from '$lib/content/registry';
import { invalidateAll } from '$lib/server/cache';
import { site } from '$lib/site';
import type { NewNode } from '$lib/content/types';

export const prerender = false;

/**
 * Bulk import used by content migration. Accepts structured nodes (markdown
 * body only); rendering happens here through the normal pipeline.
 *
 * Idempotency is keyed on the human identity `(type, slug, lang)` — node ids are
 * generated ULIDs, so callers must not supply them. Grouping (translations) is
 * carried by `groupId` on each node, so callers may batch freely.
 */
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	let payload: { nodes?: NewNode[]; replace?: boolean };
	try {
		payload = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	const nodes = payload.nodes ?? [];
	const imported: string[] = [];

	for (const input of nodes) {
		if (!input.type || !input.slug) continue;
		if (!getContentType(input.type)) {
			return json({ error: `unknown type: ${input.type}` }, { status: 400 });
		}
		if (input.status && !['draft', 'scheduled', 'published', 'archived'].includes(input.status)) {
			return json({ error: 'invalid status' }, { status: 400 });
		}
		if (input.visibility && !['public', 'private'].includes(input.visibility)) {
			return json({ error: 'invalid visibility' }, { status: 400 });
		}
		const lang = input.lang ?? site.defaultLocale;
		const existing = await getNodeBySlug(db, input.type, input.slug, lang);

		if (existing) {
			if (payload.replace) await deleteNode(db, existing.id);
			else {
				await updateNode(db, existing.id, input);
				imported.push(existing.id);
				continue;
			}
		}

		const created = await createNode(db, input);
		imported.push(created.id);
	}

	await invalidateAll(event.url.origin);
	return json({ ok: true, count: imported.length, ids: imported });
};
