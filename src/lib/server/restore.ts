/**
 * Restores a database from an export bundle (docs/EXPORT-CONTRACT.md §4).
 *
 * Order matters because of foreign keys: people → identities → assets → each
 * kind's rows → tags → bindings → media → comments → reactions. Derived columns
 * (`body_html`, the FTS tables) are recomputed here, never imported.
 *
 * An unknown kind file is skipped with a warning, so a bundle from a newer build
 * does not crash an older one — that is what makes "add a kind later" safe.
 */

import type { D1Database } from '$lib/server/db';
import { run } from '$lib/server/db';
import { renderMarkdown } from '$lib/server/render';
import { buildSearchText } from '$lib/server/search';
import { EXPORT_SCHEMA_VERSION } from '$lib/server/export';
import { fieldColumn, kindColumns, kindTable } from '$lib/server/repositories/assets';
import { getContentType } from '$lib/content/registry';

export interface ExportFile {
	path: string;
	content: string;
}

export interface RestoreResult {
	nodes: number;
	events: number;
	actors: number;
	people: number;
	comments: number;
	reactions: number;
	fields: number;
	tags: number;
	warnings: string[];
}

function parseJsonl(content: string | undefined): Record<string, unknown>[] {
	if (!content) return [];
	return content
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
}

/** True when a table exists in this database. */
async function tableExists(db: D1Database, name: string): Promise<boolean> {
	try {
		const rows = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").bind(name).all<{ name: string }>();
		return (rows.results ?? []).length > 0;
	} catch {
		return false;
	}
}

export async function restoreFromBundle(
	db: D1Database,
	files: ExportFile[]
): Promise<RestoreResult> {
	const map = new Map<string, string>();
	for (const file of files) map.set(file.path, file.content);

	const schemaRaw = map.get('schema.json');
	const schema = schemaRaw
		? (JSON.parse(schemaRaw) as { version?: number; types?: string[] })
		: {};
	if (schemaRaw) {
		const version = typeof schema.version === 'number' ? schema.version : 1;
		if (version > EXPORT_SCHEMA_VERSION) {
			throw new Error(
				`export format v${version} is newer than this build supports (v${EXPORT_SCHEMA_VERSION})`
			);
		}
		if (version < EXPORT_SCHEMA_VERSION) {
			throw new Error(
				`export format v${version} is older than this build supports (v${EXPORT_SCHEMA_VERSION}); ` +
					`convert it first (see docs/DATA-MODEL.md §10)`
			);
		}
	}

	const warnings: string[] = [];
	const people = parseJsonl(map.get('people.jsonl'));
	const identities = parseJsonl(map.get('identities.jsonl'));
	const assets = parseJsonl(map.get('assets.jsonl'));
	const comments = parseJsonl(map.get('comments.jsonl'));
	const reactions = parseJsonl(map.get('reactions.jsonl'));
	const tags = parseJsonl(map.get('tags.jsonl'));
	const assetTags = parseJsonl(map.get('asset_tags.jsonl'));
	const media = parseJsonl(map.get('media.jsonl'));
	const assetMedia = parseJsonl(map.get('asset_media.jsonl'));

	// Which kind files are present: what the bundle says, or what its files imply.
	const declared = Array.isArray(schema.types)
		? schema.types.filter((t): t is string => typeof t === 'string')
		: [];

	for (const p of people) {
		await run(
			db,
			`INSERT INTO people (id, role, handle, display_name, avatar_url, email_hash, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				role = excluded.role, handle = excluded.handle, display_name = excluded.display_name,
				avatar_url = excluded.avatar_url, email_hash = excluded.email_hash,
				created_at = excluded.created_at, updated_at = excluded.updated_at`,
			[p.id, p.role ?? null, p.handle, p.display_name, p.avatar_url, p.email_hash, p.created_at, p.updated_at]
		);
	}

	for (const i of identities) {
		await run(
			db,
			`INSERT INTO identities (provider, provider_uid, person_id, created_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT(provider, provider_uid) DO UPDATE SET
				person_id = excluded.person_id, created_at = excluded.created_at`,
			[i.provider, i.provider_uid, i.person_id, i.created_at]
		);
	}

	for (const a of assets) {
		await run(
			db,
			`INSERT INTO assets
				(id, type, lang, group_id, status, visibility, published_at, occurred_at,
				 author_id, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				type = excluded.type, lang = excluded.lang, group_id = excluded.group_id,
				status = excluded.status, visibility = excluded.visibility,
				published_at = excluded.published_at, occurred_at = excluded.occurred_at,
				author_id = excluded.author_id, created_at = excluded.created_at,
				updated_at = excluded.updated_at`,
			[
				a.id,
				a.type,
				a.lang,
				a.group_id ?? a.id,
				a.status,
				a.visibility ?? 'public',
				a.published_at ?? null,
				a.occurred_at ?? null,
				a.author_id,
				a.created_at,
				a.updated_at
			]
		);
	}

	let fieldCount = 0;
	let restored = 0;
	for (const type of declared) {
		const table = kindTable(type);
		const rows = parseJsonl(map.get(`${table}.jsonl`));
		if (rows.length === 0) continue;
		if (!(await tableExists(db, table))) {
			warnings.push(`unknown content kind "${type}" — skipped ${rows.length} row(s)`);
			continue;
		}
		const columns = kindColumns(type).filter((c) => c !== 'body_html');
		const declaredFields = (getContentType(type)?.fields ?? []).map((f) => fieldColumn(f.key));
		for (const row of rows) {
			const bodyMd = String(row.body_md ?? '');
			const html = await renderMarkdown(bodyMd);
			const values = columns.map((c) => {
				if (c === 'body_html') return html;
				if (c === 'body_md') return bodyMd;
				const v = row[c];
				return v === undefined ? null : v;
			});
			await run(
				db,
				`INSERT INTO ${table} (id, ${columns.join(', ')}, body_html)
				 VALUES (?, ${columns.map(() => '?').join(', ')}, ?)
				 ON CONFLICT(id) DO UPDATE SET ${[...columns, 'body_html']
						.map((c) => `${c} = excluded.${c}`)
						.join(', ')}`,
				[row.id, ...values, html]
			);
			fieldCount += declaredFields.length;

			const fts = `${table}_fts`;
			await run(db, `DELETE FROM ${fts} WHERE id = ?`, [row.id]);
			await run(db, `INSERT INTO ${fts} (id, lang, title, summary, body) VALUES (?, ?, ?, ?, ?)`, [
				row.id,
				row.lang,
				buildSearchText([String(row.title ?? '')]),
				buildSearchText([String(row.summary ?? '')]),
				buildSearchText([bodyMd])
			]);
			restored++;
		}
	}

	for (const t of tags) {
		await run(db, 'INSERT INTO tags (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING', [
			t.id,
			t.name
		]);
	}

	for (const b of assetTags) {
		await run(
			db,
			'INSERT INTO asset_tags (asset_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
			[b.asset_id, b.tag_id]
		);
	}

	for (const m of media) {
		await run(
			db,
			`INSERT INTO media (id, r2_key, kind, sha256, created_at) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				r2_key = excluded.r2_key, kind = excluded.kind, sha256 = excluded.sha256,
				created_at = excluded.created_at`,
			[m.id, m.r2_key, m.kind, m.sha256 ?? null, m.created_at]
		);
	}

	for (const b of assetMedia) {
		await run(
			db,
			`INSERT INTO asset_media (asset_id, media_id, position, alt, role) VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(asset_id, media_id) DO UPDATE SET
				position = excluded.position, alt = excluded.alt, role = excluded.role`,
			[b.asset_id, b.media_id, b.position ?? 0, b.alt ?? null, b.role ?? 'body']
		);
	}

	for (const c of comments) {
		await run(
			db,
			`INSERT INTO comments
				(id, asset_id, parent_id, author_id, body_md, status, moderated_at, moderated_by, payload, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
				asset_id = excluded.asset_id, parent_id = excluded.parent_id,
				author_id = excluded.author_id, body_md = excluded.body_md,
				status = excluded.status, moderated_at = excluded.moderated_at,
				moderated_by = excluded.moderated_by, payload = excluded.payload,
				created_at = excluded.created_at`,
			[
				c.id,
				c.asset_id,
				c.parent_id,
				c.author_id,
				c.body_md,
				c.status,
				c.moderated_at,
				c.moderated_by,
				c.payload ? JSON.stringify(c.payload) : null,
				c.created_at
			]
		);
	}

	for (const r of reactions) {
		await run(
			db,
			'INSERT INTO reactions (asset_id, person_id, emoji, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
			[r.asset_id, r.person_id, r.emoji, r.created_at]
		);
	}

	return {
		nodes: restored,
		events: comments.length,
		actors: people.length,
		people: people.length,
		comments: comments.length,
		reactions: reactions.length,
		fields: fieldCount,
		tags: tags.length,
		warnings
	};
}
