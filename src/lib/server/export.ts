/**
 * Canonical export — the portability contract.
 *
 * Everything in the platform must be reconstructible from this format alone.
 * Output is deterministic (stable key order, sorted rows, normalized
 * timestamps) so repeated exports produce clean diffs in the git mirror.
 */

import type { D1Database } from '$lib/server/db';
import { query } from '$lib/server/db';

export const EXPORT_SCHEMA_VERSION = 1;

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
			published_at, created_at, updated_at, extra
		 FROM nodes ORDER BY id`
	);
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

	files.push({
		path: 'schema.json',
		content: stableStringify({
			version: EXPORT_SCHEMA_VERSION,
			generator: 'sprout-export',
			tables: [
				'nodes',
				'relations',
				'media',
				'events',
				'event_status',
				'actors',
				'actor_identities'
			]
		})
	});

	// Canonical node records (without raw markdown duplicated in jsonl body).
	files.push({
		path: 'nodes.jsonl',
		content: toJsonl(
			nodes.map((n) => ({
				...n,
				extra: parseJson(n.extra as string | null)
			}))
		)
	});
	files.push({ path: 'relations.jsonl', content: toJsonl(relations) });
	files.push({ path: 'media.jsonl', content: toJsonl(media) });
	files.push({
		path: 'events.jsonl',
		content: toJsonl(events.map((e) => ({ ...e, payload: parseJson(e.payload as string | null) })))
	});
	files.push({ path: 'event_status.jsonl', content: toJsonl(eventStatus) });
	files.push({ path: 'actors.jsonl', content: toJsonl(actors) });
	files.push({ path: 'actor_identities.jsonl', content: toJsonl(actorIdentities) });

	// Human-readable markdown mirror, one file per node.
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
			n.group_id ? `group_id: ${n.group_id}` : 'group_id:',
			`title: ${JSON.stringify(n.title ?? '')}`,
			`summary: ${JSON.stringify(n.summary ?? '')}`,
			`status: ${n.status}`,
			`published_at: ${n.published_at ?? ''}`,
			`created_at: ${n.created_at}`,
			`updated_at: ${n.updated_at}`,
			`extra: ${stableStringify(parseJson(n.extra as string | null) ?? {})}`,
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
