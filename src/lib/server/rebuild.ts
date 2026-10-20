/**
 * Rebuild derived caches. `body_html` is written at save time; a renderer change
 * only affects newly saved content unless this runs. The source markdown and all
 * timestamps are left untouched — the column is reproducible by definition.
 */

import type { D1Database } from '$lib/server/db';
import type { ContentNode } from '$lib/content/types';
import { renderMarkdown } from '$lib/server/render';
import { getNode, listNodes, setBodyHtml } from '$lib/server/repositories/nodes';

export interface RebuildResult {
	scanned: number;
	updated: number;
	skipped: number;
}

export async function rebuildBodyHtml(db: D1Database, id?: string): Promise<RebuildResult> {
	let nodes: ContentNode[];
	if (id) {
		const one = await getNode(db, id);
		nodes = one ? [one] : [];
	} else {
		nodes = await listNodes(db, { limit: 1000 });
	}

	let updated = 0;
	let skipped = 0;

	for (const node of nodes) {
		if (!node.bodyMd) {
			skipped++;
			continue;
		}
		const html = await renderMarkdown(node.bodyMd);
		if (html === node.bodyHtml) {
			skipped++;
			continue;
		}
		await setBodyHtml(db, node.id, html);
		updated++;
	}

	return { scanned: nodes.length, updated, skipped };
}
