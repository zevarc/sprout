/**
 * Rebuild derived caches. `body_html` is written at save time; a renderer change
 * only affects newly saved content unless this runs. The source markdown and all
 * timestamps are left untouched — the column is reproducible by definition.
 */

import type { D1Database } from '$lib/server/db';
import { renderMarkdown } from '$lib/server/render';
import { getAsset, listAssets, setBodyHtml } from '$lib/server/repositories/assets';
import { listTypes } from '$lib/content/registry';

export interface RebuildResult {
	scanned: number;
	updated: number;
	skipped: number;
}

/**
 * Rewrites `body_html` for one asset (when `id` is given) or for every asset of
 * every declared kind. Rendering happens per kind because the column lives on the
 * kind's table.
 */
export async function rebuildBodyHtml(db: D1Database, id?: string): Promise<RebuildResult> {
	let scanned = 0;
	let updated = 0;
	let skipped = 0;

	const kinds = id ? [] : listTypes().map((t) => t.type);
	const targets = id
		? [await getAsset(db, id)].filter((n): n is NonNullable<typeof n> => Boolean(n))
		: (
				await Promise.all(
					kinds.map((type) =>
						listAssets(db, { type, status: 'all', limit: 1000 })
					)
				)
			).flat();

	for (const node of targets) {
		scanned++;
		if (!node.bodyMd) {
			skipped++;
			continue;
		}
		const html = await renderMarkdown(node.bodyMd);
		if (html === node.bodyHtml) {
			skipped++;
			continue;
		}
		await setBodyHtml(db, node.type, node.id, html);
		updated++;
	}

	return { scanned, updated, skipped };
}
