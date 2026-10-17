import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, query, run } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { createNode, getNode, updateNode, deleteNode } from '$lib/server/repositories/nodes';
import type { NewNode } from '$lib/content/types';

export const prerender = false;

/**
 * Bulk import used by content migration. Accepts structured nodes (markdown
 * body only); rendering happens here through the normal pipeline.
 *
 * Relations are derived server-side from `groupId`, so callers may batch
 * freely without splitting a translation pair across requests.
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
	const groups = new Set<string>();

	for (const input of nodes) {
		if (!input.id) continue;
		const existing = await getNode(db, input.id);
		if (existing) {
			if (payload.replace) await deleteNode(db, input.id);
			else await updateNode(db, input.id, input);
		}
		if (!existing || payload.replace) await createNode(db, input);
		imported.push(input.id);
		if (input.groupId) groups.add(input.groupId);
	}

	// Pairwise translation relations for every group touched by this batch.
	let relationsCreated = 0;
	for (const groupId of groups) {
		const members = await query<{ id: string }>(
			db,
			'SELECT id FROM nodes WHERE group_id = ?',
			[groupId]
		);
		if (members.length < 2) continue;
		for (const a of members) {
			for (const b of members) {
				if (a.id === b.id) continue;
				await run(
					db,
					`INSERT OR REPLACE INTO relations (from_id, to_id, rel) VALUES (?, ?, 'translation')`,
					[a.id, b.id]
				);
				relationsCreated++;
			}
		}
	}

	return json({ ok: true, count: imported.length, relations: relationsCreated, ids: imported });
};
