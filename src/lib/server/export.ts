/**
 * Canonical export — the portability contract (docs/EXPORT-CONTRACT.md).
 *
 * One file per table, deterministic order, no rendered HTML. The kind files are
 * listed in `schema.json.types` so a restore knows exactly what to expect.
 */

import type { D1Database } from '$lib/server/db';
import { first, query } from '$lib/server/db';
import { exportCommentRows } from '$lib/server/repositories/comments';
import { exportIdentityRows, exportPersonRows } from '$lib/server/repositories/people';
import { exportReactionRows } from '$lib/server/repositories/reactions';
import { exportAssetTagRows, exportTagRows } from '$lib/server/repositories/tags';
import { kindColumns, kindTable } from '$lib/server/repositories/assets';

export const EXPORT_SCHEMA_VERSION = 4;

/** JSON.stringify with recursively sorted object keys. */
function stableStringify(value: unknown): string {
	return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>).sort()) {
			out[key] = sortKeys((value as Record<string, unknown>)[key]);
		}
		return out;
	}
	return value;
}

function toJsonl(rows: unknown[]): string {
	if (rows.length === 0) return '';
	return rows.map((r) => stableStringify(r)).join('\n') + '\n';
}

function parseJson(value: string | null): unknown {
	if (!value) return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

export interface ExportFile {
	path: string;
	content: string;
}

export interface ExportBundle {
	files: ExportFile[];
	nodeCount: number;
	eventCount: number;
	/** The content kinds whose files are present. */
	types: string[];
}

/** Builds the full text export from the database. */
export async function buildExport(db: D1Database): Promise<ExportBundle> {
	const people = await exportPersonRows(db);
	const identities = await exportIdentityRows(db);
	const assets = await query<Record<string, unknown>>(
		db,
		`SELECT id, type, lang, group_id, status, visibility, published_at, occurred_at,
		        author_id, created_at, updated_at
		   FROM assets ORDER BY id`
	);
	const comments = await exportCommentRows(db);
	const reactions = await exportReactionRows(db);
	const tags = await exportTagRows(db);
	const assetTags = await exportAssetTagRows(db);
	const media = await query<Record<string, unknown>>(
		db,
		'SELECT id, r2_key, kind, sha256, created_at FROM media ORDER BY id'
	);
	const assetMedia = await query<Record<string, unknown>>(
		db,
		'SELECT asset_id, media_id, position, alt, role FROM asset_media ORDER BY asset_id, media_id'
	);

	// Every kind that actually has assets, whatever the current config declares:
	// a bundle must be complete for the data it came from.
	const types = (
		await query<{ type: string }>(db, 'SELECT DISTINCT type FROM assets ORDER BY type')
	).map((r) => r.type);

	const files: ExportFile[] = [];
	const schemaRow = await first<{ value: string }>(
		db,
		"SELECT value FROM meta WHERE key = 'schema_version'"
	);

	files.push({
		path: 'schema.json',
		content: stableStringify({
			version: EXPORT_SCHEMA_VERSION,
			db_schema: schemaRow?.value ?? '4',
			generator: 'sprout-export',
			tables: [
				'people',
				'identities',
				'assets',
				...types.map(kindTable),
				'comments',
				'reactions',
				'tags',
				'asset_tags',
				'media',
				'asset_media'
			],
			types
		})
	});

	files.push({ path: 'people.jsonl', content: toJsonl(people) });
	files.push({ path: 'identities.jsonl', content: toJsonl(identities) });
	files.push({ path: 'assets.jsonl', content: toJsonl(assets) });
	files.push({ path: 'comments.jsonl', content: toJsonl(comments) });
	files.push({ path: 'reactions.jsonl', content: toJsonl(reactions) });
	files.push({ path: 'tags.jsonl', content: toJsonl(tags) });
	files.push({ path: 'asset_tags.jsonl', content: toJsonl(assetTags) });
	files.push({ path: 'media.jsonl', content: toJsonl(media) });
	files.push({ path: 'asset_media.jsonl', content: toJsonl(assetMedia) });

	// One file per kind: its declared columns, minus the derived HTML.
	const tagsByAsset = new Map<string, string[]>();
	{
		const rows = await query<{ asset_id: string; name: string }>(
			db,
			`SELECT at.asset_id AS asset_id, t.name AS name
			   FROM asset_tags at JOIN tags t ON t.id = at.tag_id
			  ORDER BY at.asset_id, t.name`
		);
		for (const row of rows) {
			const bucket = tagsByAsset.get(row.asset_id) ?? [];
			bucket.push(row.name);
			tagsByAsset.set(row.asset_id, bucket);
		}
	}

	const kindRows = new Map<string, Record<string, unknown>[]>();
	for (const type of types) {
		const columns = kindColumns(type).filter((c) => c !== 'body_html');
		const rows = await query<Record<string, unknown>>(
			db,
			`SELECT id, ${columns.join(', ')} FROM ${kindTable(type)} ORDER BY id`
		);
		kindRows.set(type, rows);
		files.push({ path: `${kindTable(type)}.jsonl`, content: toJsonl(rows) });
	}

	// Human-readable mirror, one file per asset.
	const assetById = new Map(assets.map((a) => [String(a.id), a]));
	for (const type of types) {
		const rows = kindRows.get(type) ?? [];
		for (const row of rows) {
			const asset = assetById.get(String(row.id));
			if (!asset) continue;
			const fields: Record<string, unknown> = {};
			for (const field of kindColumns(type)) {
				if (['id', 'lang', 'slug', 'title', 'summary', 'body_md', 'body_html'].includes(field)) continue;
				if (row[field] !== null && row[field] !== undefined) fields[field] = row[field];
			}
			const frontmatter = [
				'---',
				`id: ${asset.id}`,
				`type: ${type}`,
				`lang: ${asset.lang}`,
				`slug: ${row.slug}`,
				`group_id: ${asset.group_id}`,
				`title: ${JSON.stringify(row.title ?? '')}`,
				`summary: ${JSON.stringify(row.summary ?? '')}`,
				`status: ${asset.status}`,
				`published_at: ${asset.published_at ?? ''}`,
				`occurred_at: ${asset.occurred_at ?? ''}`,
				`visibility: ${asset.visibility ?? 'public'}`,
				`author_id: ${asset.author_id}`,
				`created_at: ${asset.created_at}`,
				`updated_at: ${asset.updated_at}`,
				`tags: ${stableStringify(tagsByAsset.get(String(asset.id)) ?? [])}`,
				`fields: ${stableStringify(fields)}`,
				'---',
				''
			].join('\n');
			files.push({
				path: `nodes/${type}/${row.slug}.${asset.lang}.md`,
				content: frontmatter + String(row.body_md ?? '')
			});
		}
	}

	return {
		files,
		nodeCount: assets.length,
		eventCount: comments.length,
		types
	};
}
