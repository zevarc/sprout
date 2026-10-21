/**
 * Canonical export — the portability contract.
 *
 * Everything in the platform must be reconstructible from this format alone.
 * Output is deterministic (stable key order, sorted rows, normalized
 * timestamps) so repeated exports produce clean diffs in the git mirror.
 */

import type { D1Database } from '$lib/server/db';
import { first, query } from '$lib/server/db';
import { exportFieldRows } from '$lib/server/repositories/fields';
import { exportTagRows } from '$lib/server/repositories/tags';

/**
 * v1 → v2: ids became opaque; derived HTML/relations left the export.
 * v2 → v3: `nodes.extra` became relational — `node_fields` rows, `node_tags`
 *          rows, and cross-type concepts as columns (featured, cover).
 */
export const EXPORT_SCHEMA_VERSION = 3;

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
}

/** Builds the full text export from the database. */
export async function buildExport(db: D1Database): Promise<ExportBundle> {
	const nodes = await query<Record<string, unknown>>(
		db,
		`SELECT id, type, slug, lang, group_id, title, summary, body_md, status,
			published_at, occurred_at, visibility, featured, cover_media_id,
			author_actor_id, created_at, updated_at
		 FROM nodes ORDER BY id`
	);
	const fieldRows = await exportFieldRows(db);
	const tagRows = await exportTagRows(db);
	const relations = await query<Record<string, unknown>>(
		db,
		'SELECT from_id, to_id, rel FROM relations ORDER BY from_id, to_id, rel'
	);
	const media = await query<Record<string, unknown>>(
		db,
		'SELECT id, node_id, r2_key, kind, width, height, alt, position, sha256 FROM media ORDER BY id'
	);
	const events = await query<Record<string, unknown>>(
		db,
		`SELECT id, kind, target_type, target_id, actor_id, parent_id, body_md, payload, created_at
		 FROM events ORDER BY id`
	);
	const eventStatus = await query<Record<string, unknown>>(
		db,
		'SELECT event_id, status, at, by FROM event_status ORDER BY event_id, at, rowid'
	);
	const actors = await query<Record<string, unknown>>(
		db,
		`SELECT id, kind, handle, display_name, avatar_url, email_hash, created_at
		 FROM actors ORDER BY id`
	);
	const actorIdentities = await query<Record<string, unknown>>(
		db,
		'SELECT actor_id, provider, provider_uid FROM actor_identities ORDER BY actor_id, provider'
	);

	const files: ExportFile[] = [];

	const schemaRow = await first<{ value: string }>(
		db,
		"SELECT value FROM meta WHERE key = 'schema_version'"
	);

	files.push({
		path: 'schema.json',
		content: stableStringify({
			version: EXPORT_SCHEMA_VERSION,
			db_schema: schemaRow?.value ?? '3',
			generator: 'sprout-export',
			tables: [
				'nodes',
				'node_fields',
				'node_tags',
				'relations',
				'media',
				'events',
				'event_status',
				'actors',
				'actor_identities'
			]
		})
	});

	// Nodes carry no blobs; type-specific data lives in its own files.
	files.push({ path: 'nodes.jsonl', content: toJsonl(nodes) });
	files.push({ path: 'node_fields.jsonl', content: toJsonl(fieldRows) });
	files.push({ path: 'node_tags.jsonl', content: toJsonl(tagRows) });
	files.push({ path: 'relations.jsonl', content: toJsonl(relations) });
	files.push({ path: 'media.jsonl', content: toJsonl(media) });
	files.push({
		path: 'events.jsonl',
		content: toJsonl(events.map((e) => ({ ...e, payload: parseJson(e.payload as string | null) })))
	});
	files.push({ path: 'event_status.jsonl', content: toJsonl(eventStatus) });
	files.push({ path: 'actors.jsonl', content: toJsonl(actors) });
	files.push({ path: 'actor_identities.jsonl', content: toJsonl(actorIdentities) });

	// Human-readable mirror, one file per node: fields render as frontmatter.
	const fieldsByNode = new Map<string, Record<string, unknown>>();
	for (const row of fieldRows) {
		const bucket = fieldsByNode.get(String(row.node_id)) ?? {};
		bucket[String(row.field)] = row.value;
		fieldsByNode.set(String(row.node_id), bucket);
	}
	const tagsByNode = new Map<string, string[]>();
	for (const row of tagRows) {
		const bucket = tagsByNode.get(String(row.node_id)) ?? [];
		bucket.push(String(row.tag));
		tagsByNode.set(String(row.node_id), bucket);
	}

	for (const n of nodes) {
		const type = String(n.type);
		const slug = String(n.slug);
		const lang = String(n.lang);
		const frontmatter = [
			'---',
			`id: ${n.id}`,
			`type: ${type}`,
			`slug: ${slug}`,
			`lang: ${lang}`,
			`group_id: ${n.group_id}`,
			`title: ${JSON.stringify(n.title ?? '')}`,
			`summary: ${JSON.stringify(n.summary ?? '')}`,
			`status: ${n.status}`,
			`published_at: ${n.published_at ?? ''}`,
			`occurred_at: ${n.occurred_at ?? ''}`,
			`visibility: ${n.visibility ?? 'public'}`,
			`featured: ${n.featured === 1 ? 'true' : 'false'}`,
			`cover_media_id: ${n.cover_media_id ?? ''}`,
			`author_actor_id: ${n.author_actor_id ?? ''}`,
			`created_at: ${n.created_at}`,
			`updated_at: ${n.updated_at}`,
			`tags: ${stableStringify(tagsByNode.get(String(n.id)) ?? [])}`,
			`fields: ${stableStringify(fieldsByNode.get(String(n.id)) ?? {})}`,
			'---',
			''
		].join('\n');
		files.push({
			path: `nodes/${type}/${slug}.${lang}.md`,
			content: frontmatter + String(n.body_md ?? '')
		});
	}

	return {
		files,
		nodeCount: nodes.length,
		eventCount: events.length
	};
}
