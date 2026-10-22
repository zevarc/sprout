#!/usr/bin/env node
/**
 * Converts an export bundle from format v3 to v4.
 *
 *   node scripts/migrate-v3-to-v4.mjs <v3-dir> <v4-dir>
 *
 * v3 → v4 (docs/DATA-MODEL.md §10):
 *   · one shared `assets` row + one row per kind table (real columns);
 *   · `node_fields` → columns on the kind's table, only for fields the site
 *     declares (anything else is reported, never silently dropped);
 *   · `node_tags` → `tags` + `asset_tags` (a vocabulary shared by assets);
 *   · `media.node_id` → `asset_media` bindings; `cover_media_id` → role 'cover';
 *   · `events` kind comment/reaction → `comments` / `reactions`;
 *   · `actors` → `people` (`kind` → `role`, `email_enc` dropped).
 *
 * The output is a complete v4 bundle; restore it with `pnpm content:restore`.
 * Markdown mirrors are regenerated; media binaries are copied unchanged.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { contentTypes } from '../src/sprout.config.js';

const [INPUT, OUTPUT] = process.argv.slice(2);
if (!INPUT || !OUTPUT) {
	console.error('usage: node scripts/migrate-v3-to-v4.mjs <v3-dir> <v4-dir>');
	process.exit(1);
}
const IN = resolve(INPUT);
const OUT = resolve(OUTPUT);
if (IN === OUT) {
	console.error('input and output must differ');
	process.exit(1);
}

const read = (name) => {
	try {
		return readFileSync(join(IN, name), 'utf8');
	} catch {
		return '';
	}
};
const jsonl = (text) =>
	text
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
const stable = (value) => {
	if (Array.isArray(value)) return value.map(stable);
	if (value && typeof value === 'object') {
		const out = {};
		for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
		return out;
	}
	return value;
};
const toJsonl = (rows) => (rows.length ? rows.map((r) => JSON.stringify(stable(r))).join('\n') + '\n' : '');
const kindTable = (type) => `${String(type).toLowerCase()}s`;
const fieldColumn = (key) => key.trim().replace(/[^A-Za-z0-9_]/g, '_');
/** Deterministic id, so two runs over the same input produce the same bundle. */
const idFor = (prefix, seed) =>
	prefix + createHash('sha1').update(seed).digest('hex').slice(0, 24).toUpperCase();

const schema = JSON.parse(read('schema.json') || '{}');
if (typeof schema.version === 'number' && schema.version >= 4) {
	console.error(`input is already format v${schema.version}; nothing to do`);
	process.exit(1);
}

const warnings = [];
const nodes = jsonl(read('nodes.jsonl'));
const fieldRows = jsonl(read('node_fields.jsonl'));
const tagRows = jsonl(read('node_tags.jsonl'));
const mediaRows = jsonl(read('media.jsonl'));
const events = jsonl(read('events.jsonl'));
const eventStatus = jsonl(read('event_status.jsonl'));
const actors = jsonl(read('actors.jsonl'));
const identities = jsonl(read('actor_identities.jsonl'));

// Latest moderation state per event (v3's "newest wins").
const latestStatus = new Map();
for (const row of eventStatus) latestStatus.set(row.event_id, row);

// ---- people ----
const people = actors.map((a) => ({
	id: a.id,
	role: a.kind === 'owner' || a.kind === 'member' ? a.kind : null,
	handle: a.handle ?? null,
	display_name: a.display_name ?? null,
	avatar_url: a.avatar_url ?? null,
	email_hash: a.email_hash ?? null,
	created_at: a.created_at,
	updated_at: a.created_at
}));

// ---- kinds ----
const declared = new Map(Object.entries(contentTypes).map(([type, def]) => [type, def]));
const fieldsByNode = new Map();
for (const row of fieldRows) {
	const type = nodes.find((n) => n.id === row.node_id)?.type;
	const def = declared.get(type);
	const key = def?.fields?.find((f) => f.key === row.field);
	if (!def) {
		warnings.push(`field "${row.field}" on unknown type "${type}" — dropped`);
		continue;
	}
	if (!key) {
		warnings.push(`field "${row.field}" is not declared for "${type}" — dropped`);
		continue;
	}
	const bucket = fieldsByNode.get(row.node_id) ?? {};
	bucket[fieldColumn(row.field)] = row.kind === 'bool' ? (row.value ? 1 : 0) : row.value;
	fieldsByNode.set(row.node_id, bucket);
}

// ---- tags as a vocabulary ----
const tagIdByName = new Map();
const tags = [];
for (const row of tagRows) {
	if (tagIdByName.has(row.tag)) continue;
	const id = idFor('T', row.tag);
	tagIdByName.set(row.tag, id);
	tags.push({ id, name: row.tag });
}
const assetTags = tagRows.map((row) => ({ asset_id: row.node_id, tag_id: tagIdByName.get(row.tag) }));

// ---- media: one object per key, one binding per use ----
const mediaByKey = new Map();
const media = [];
const assetMedia = [];
for (const row of mediaRows) {
	let object = mediaByKey.get(row.r2_key);
	if (!object) {
		object = {
			id: idFor('M', row.r2_key),
			r2_key: row.r2_key,
			kind: row.kind ?? 'image',
			sha256: row.sha256 ?? row.r2_key.split('.')[0] ?? null,
			created_at: new Date(0).toISOString()
		};
		mediaByKey.set(row.r2_key, object);
		media.push(object);
	}
	if (row.node_id) {
		assetMedia.push({
			asset_id: row.node_id,
			media_id: object.id,
			position: row.position ?? 0,
			alt: row.alt ?? null,
			role: 'body'
		});
	}
}

// ---- assets + kind rows ----
const assets = [];
const kindRows = new Map();
const markdown = new Map();

for (const node of nodes) {
	const type = node.type;
	const table = kindTable(type);
	const def = declared.get(type);
	if (!def) {
		warnings.push(`asset ${node.id} has unknown type "${type}" — skipped`);
		continue;
	}

	const cover = node.cover_media_id ? media.find((m) => m.id === node.cover_media_id) : null;
	if (node.cover_media_id && !cover) {
		warnings.push(`asset ${node.id} cover ${node.cover_media_id} not found — dropped`);
	}
	const coverKey = mediaRows.find((m) => m.id === node.cover_media_id)?.r2_key;
	const coverObject = coverKey ? mediaByKey.get(coverKey) : null;
	if (node.cover_media_id && coverObject) {
		const existing = assetMedia.find((b) => b.asset_id === node.id && b.media_id === coverObject.id);
		if (existing) existing.role = 'cover';
		else
			assetMedia.push({
				asset_id: node.id,
				media_id: coverObject.id,
				position: 0,
				alt: null,
				role: 'cover'
			});
	}

	const status = node.status === 'scheduled' ? 'draft' : node.status;
	if (node.status === 'scheduled') warnings.push(`asset ${node.id}: scheduled → draft (no scheduler exists)`);

	assets.push({
		id: node.id,
		type,
		lang: node.lang,
		group_id: node.group_id ?? node.id,
		status,
		visibility: node.visibility ?? 'public',
		published_at: node.published_at ?? null,
		occurred_at: node.occurred_at ?? null,
		author_id: node.author_actor_id ?? people.find((p) => p.role === 'owner')?.id,
		created_at: node.created_at,
		updated_at: node.updated_at
	});

	const row = {
		id: node.id,
		lang: node.lang,
		slug: node.slug,
		title: node.title ?? null,
		summary: node.summary ?? null,
		body_md: node.body_md ?? '',
		...(fieldsByNode.get(node.id) ?? {})
	};
	for (const field of def.fields ?? []) {
		const column = fieldColumn(field.key);
		if (!(column in row)) row[column] = null;
	}
	const list = kindRows.get(table) ?? [];
	list.push(row);
	kindRows.set(table, list);

	const nodeTags = tagRows.filter((t) => t.node_id === node.id).map((t) => t.tag);
	markdown.set(
		`nodes/${type}/${node.slug}.${node.lang}.md`,
		[
			'---',
			`id: ${node.id}`,
			`type: ${type}`,
			`lang: ${node.lang}`,
			`slug: ${node.slug}`,
			`group_id: ${row.group_id ?? node.group_id}`,
			`title: ${JSON.stringify(node.title ?? '')}`,
			`summary: ${JSON.stringify(node.summary ?? '')}`,
			`status: ${status}`,
			`published_at: ${node.published_at ?? ''}`,
			`occurred_at: ${node.occurred_at ?? ''}`,
			`visibility: ${node.visibility ?? 'public'}`,
			`author_id: ${node.author_actor_id ?? ''}`,
			`created_at: ${node.created_at}`,
			`updated_at: ${node.updated_at}`,
			`tags: ${JSON.stringify(stable(nodeTags))}`,
			`fields: ${JSON.stringify(stable(fieldsByNode.get(node.id) ?? {}))}`,
			'---',
			''
		].join('\n') + String(node.body_md ?? '')
	);
}

// ---- interactions ----
const comments = [];
const reactions = [];
for (const event of events) {
	if (event.kind === 'comment') {
		const latest = latestStatus.get(event.id);
		comments.push({
			id: event.id,
			asset_id: event.target_id,
			parent_id: event.parent_id ?? null,
			author_id: event.actor_id,
			body_md: event.body_md ?? '',
			status: latest?.status ?? 'approved',
			moderated_at: latest?.at ?? null,
			moderated_by: latest?.by ?? null,
			payload: event.payload ?? null,
			created_at: event.created_at
		});
	} else if (event.kind === 'reaction') {
		reactions.push({
			asset_id: event.target_id,
			person_id: event.actor_id,
			emoji: event.payload?.emoji ?? '👍',
			created_at: event.created_at
		});
	} else {
		warnings.push(`event ${event.id} kind "${event.kind}" has no table in v4 — dropped`);
	}
}

// ---- write the bundle ----
rmSync(OUT, { recursive: true, force: true });
const tables = [
	'people',
	'identities',
	'assets',
	...[...kindRows.keys()],
	'comments',
	'reactions',
	'tags',
	'asset_tags',
	'media',
	'asset_media'
];
const files = {
	'schema.json': JSON.stringify(
		{
			version: 4,
			db_schema: '4',
			generator: 'sprout-export',
			tables,
			types: [...new Set(assets.map((a) => a.type))].sort()
		},
		null,
		2
	),
	'people.jsonl': toJsonl(people),
	'identities.jsonl': toJsonl(
		identities.map((i) => ({
			provider: i.provider,
			provider_uid: i.provider_uid,
			person_id: i.actor_id,
			created_at: new Date(0).toISOString()
		}))
	),
	'assets.jsonl': toJsonl(assets),
	'comments.jsonl': toJsonl(comments),
	'reactions.jsonl': toJsonl(reactions),
	'tags.jsonl': toJsonl(tags),
	'asset_tags.jsonl': toJsonl(assetTags),
	'media.jsonl': toJsonl(media),
	'asset_media.jsonl': toJsonl(assetMedia)
};
for (const [table, rows] of kindRows) files[`${table}.jsonl`] = toJsonl(rows);

for (const [name, content] of Object.entries(files)) {
	const target = join(OUT, name);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content);
}
for (const [name, content] of markdown) {
	const target = join(OUT, name);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, content);
}

// Media binaries keep their keys.
try {
	for (const name of readdirSync(join(IN, 'media'))) {
		const from = join(IN, 'media', name);
		if (!statSync(from).isFile()) continue;
		const to = join(OUT, 'media', name);
		mkdirSync(dirname(to), { recursive: true });
		writeFileSync(to, readFileSync(from));
	}
} catch {
	/* no media directory */
}

console.log(`Converted ${assets.length} assets: ${IN} → ${OUT}`);
console.log(`  kinds:  ${[...kindRows.keys()].join(', ') || '(none)'}`);
console.log(`  tags:   ${tags.length}`);
console.log(`  media:  ${media.length} object(s), ${assetMedia.length} binding(s)`);
console.log(`  comments: ${comments.length}, reactions: ${reactions.length}`);
if (warnings.length) {
	console.log(`\n${warnings.length} warning(s):`);
	for (const warning of warnings) console.log(`  · ${warning}`);
}
