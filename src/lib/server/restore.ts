/**
 * Restores a database from an export bundle.
 *
 * Extracted from the HTTP endpoint so it is testable without Cloudflare —
 * see `tests/export-restore.test.js`, which round-trips through an in-memory
 * SQLite database.
 */

import type { D1Database } from '$lib/server/db';
import { run } from '$lib/server/db';
import { renderMarkdown } from '$lib/server/render';
import { buildSearchText } from '$lib/server/search';

export interface ExportFile {
	path: string;
	content: string;
}

export interface RestoreResult {
	nodes: number;
	events: number;
	actors: number;
	relations: number;
}

function parseJsonl(content: string | undefined): Record<string, unknown>[] {
	if (!content) return [];
	return content
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
}

export async function restoreFromBundle(
	db: D1Database,
	files: ExportFile[]
): Promise<RestoreResult> {
	const map = new Map<string, string>();
	for (const file of files) map.set(file.path, file.content);

	const nodes = parseJsonl(map.get('nodes.jsonl'));
	const relations = parseJsonl(map.get('relations.jsonl'));
	const media = parseJsonl(map.get('media.jsonl'));
	const events = parseJsonl(map.get('events.jsonl'));
	const eventStatus = parseJsonl(map.get('event_status.jsonl'));
	const actors = parseJsonl(map.get('actors.jsonl'));
	const identities = parseJsonl(map.get('actor_identities.jsonl'));

	for (const a of actors) {
		await run(
			db,
			`INSERT OR REPLACE INTO actors (id, kind, handle, display_name, avatar_url, email_hash, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[a.id, a.kind, a.handle, a.display_name, a.avatar_url, a.email_hash, a.created_at]
		);
	}

	for (const i of identities) {
		await run(
			db,
			`INSERT OR REPLACE INTO actor_identities (id, actor_id, provider, provider_uid, created_at)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				`${i.actor_id}:${i.provider}:${i.provider_uid}`,
				i.actor_id,
				i.provider,
				i.provider_uid,
				new Date().toISOString()
			]
		);
	}

	for (const n of nodes) {
		const bodyMd = String(n.body_md ?? '');
		// `body_html` is derived, not exported — re-render so output is identical.
		const html = await renderMarkdown(bodyMd);
		await run(
			db,
			`INSERT OR REPLACE INTO nodes
				(id, type, slug, lang, group_id, title, summary, body_md, body_html, status, published_at, created_at, updated_at, extra)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				n.id,
				n.type,
				n.slug,
				n.lang,
				n.group_id,
				n.title,
				n.summary,
				bodyMd,
				html,
				n.status,
				n.published_at,
				n.created_at,
				n.updated_at,
				typeof n.extra === 'string' ? n.extra : JSON.stringify(n.extra ?? {})
			]
		);
		await run(db, 'DELETE FROM nodes_fts WHERE id = ?', [n.id]);
		await run(db, 'INSERT INTO nodes_fts (id, title, summary, body) VALUES (?, ?, ?, ?)', [
			n.id,
			buildSearchText([String(n.title ?? '')]),
			buildSearchText([String(n.summary ?? '')]),
			buildSearchText([bodyMd])
		]);
	}

	for (const r of relations) {
		await run(db, 'INSERT OR REPLACE INTO relations (from_id, to_id, rel) VALUES (?, ?, ?)', [
			r.from_id,
			r.to_id,
			r.rel
		]);
	}

	for (const m of media) {
		await run(
			db,
			`INSERT OR REPLACE INTO media (id, node_id, r2_key, kind, width, height, alt, position, sha256)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[m.id, m.node_id, m.r2_key, m.kind, m.width, m.height, m.alt, m.position, m.sha256]
		);
	}

	for (const e of events) {
		await run(
			db,
			`INSERT OR REPLACE INTO events
				(id, kind, target_type, target_id, actor_id, parent_id, body_md, payload, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				e.id,
				e.kind,
				e.target_type,
				e.target_id,
				e.actor_id,
				e.parent_id,
				e.body_md,
				typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload ?? null),
				e.created_at
			]
		);
	}

	for (const s of eventStatus) {
		await run(db, 'INSERT INTO event_status (event_id, status, at, by) VALUES (?, ?, ?, ?)', [
			s.event_id,
			s.status,
			s.at,
			s.by
		]);
	}

	return {
		nodes: nodes.length,
		events: events.length,
		actors: actors.length,
		relations: relations.length
	};
}
