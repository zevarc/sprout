#!/usr/bin/env node
/**
 * Converts an export bundle from format v2 to v3.
 *
 *   node scripts/migrate-v2-to-v3.mjs <v2-dir> <v3-dir>
 *
 * v2 → v3 moved type-specific data out of the `nodes.extra` JSON blob:
 *   - `extra.tags`        → node_tags.jsonl
 *   - `extra.featured`    → nodes.featured (0/1)
 *   - `extra.cover`       → nodes.cover_media_id (creates a media row if needed)
 *   - `extra.images`      → media rows (position = array index)
 *   - `extra.description` → nodes.summary (single source of truth)
 *   - everything else     → node_fields.jsonl (typed: text | number | bool | json)
 *
 * The output is a complete v3 bundle; `pnpm content:restore <v3-dir>` restores it.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

const [INPUT, OUTPUT] = process.argv.slice(2);
if (!INPUT || !OUTPUT) {
	console.error('usage: node scripts/migrate-v2-to-v3.mjs <v2-dir> <v3-dir>');
	process.exit(1);
}

const IN = resolve(INPUT);
const OUT = resolve(OUTPUT);
if (IN === OUT) {
	console.error('input and output must differ');
	process.exit(1);
}

function read(name) {
	try {
		return readFileSync(join(IN, name), 'utf8');
	} catch {
		return '';
	}
}

function jsonl(text) {
	return text
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
}

function stable(value) {
	if (Array.isArray(value)) return value.map(stable);
	if (value && typeof value === 'object') {
		const out = {};
		for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
		return out;
	}
	return value;
}

function toJsonl(rows) {
	return rows.length ? rows.map((r) => JSON.stringify(stable(r))).join('\n') + '\n' : '';
}

function kindOf(value) {
	if (typeof value === 'boolean') return 'bool';
	if (typeof value === 'number' && Number.isFinite(value)) return 'number';
	if (typeof value === 'string') return 'text';
	return 'json';
}

/** `/media/<key>` → `<key>`; anything else is not a media reference. */
function mediaKey(url) {
	if (typeof url !== 'string') return null;
	const match = url.match(/\/media\/(.+)$/);
	return match ? match[1] : null;
}

/** Deterministic id for a media row synthesized from its key. */
function mediaIdFor(key) {
	return createHash('sha1').update(key).digest('hex').slice(0, 26).toUpperCase();
}

const nodes = jsonl(read('nodes.jsonl'));
const media = jsonl(read('media.jsonl'));
const schema = JSON.parse(read('schema.json') || '{}');

if (typeof schema.version === 'number' && schema.version >= 3) {
	console.error(`input is already format v${schema.version}; nothing to do`);
	process.exit(1);
}

const mediaByKey = new Map();
for (const row of media) mediaByKey.set(String(row.r2_key), row);

const fieldRows = [];
const tagRows = [];

function ensureMedia(nodeId, key, position) {
	const existing = mediaByKey.get(key);
	if (existing) {
		if (existing.node_id == null) existing.node_id = nodeId;
		if (existing.position == null) existing.position = position;
		return existing.id;
	}
	const row = {
		id: mediaIdFor(key),
		node_id: nodeId,
		r2_key: key,
		kind: 'image',
		width: null,
		height: null,
		alt: null,
		position,
		sha256: null
	};
	mediaByKey.set(key, row);
	media.push(row);
	return row.id;
}

const v3Nodes = nodes.map((node) => {
	const extra = node.extra && typeof node.extra === 'object' ? node.extra : {};
	const nodeId = String(node.id);

	// Tags → node_tags
	const tags = Array.isArray(extra.tags) ? extra.tags : [];
	for (const tag of tags) tagRows.push({ node_id: nodeId, tag: String(tag) });

	// Cover → media row
	let coverMediaId = null;
	const coverKey = mediaKey(extra.cover);
	if (coverKey) coverMediaId = ensureMedia(nodeId, coverKey, 0);

	// Gallery images → media rows
	if (Array.isArray(extra.images)) {
		extra.images.forEach((url, index) => {
			const key = mediaKey(url);
			if (key) ensureMedia(nodeId, key, index + 1);
		});
	}

	// Remaining keys → node_fields (createdAt/updatedAt were misused in v2)
	const skip = new Set([
		'tags',
		'images',
		'cover',
		'description',
		'featured',
		'createdAt',
		'updatedAt'
	]);
	for (const [field, value] of Object.entries(extra)) {
		if (skip.has(field)) continue;
		if (value === undefined || value === null) continue;
		fieldRows.push({ node_id: nodeId, field, kind: kindOf(value), value });
	}

	const { extra: _drop, ...rest } = node;
	return {
		...rest,
		summary: node.summary || extra.description || '',
		featured: extra.featured === true ? 1 : 0,
		cover_media_id: coverMediaId
	};
});

// Markdown mirror is regenerated from the v3 shape.
const fieldsByNode = new Map();
for (const row of fieldRows) {
	const bucket = fieldsByNode.get(row.node_id) ?? {};
	bucket[row.field] = row.value;
	fieldsByNode.set(row.node_id, bucket);
}
const tagsByNode = new Map();
for (const row of tagRows) {
	const bucket = tagsByNode.get(row.node_id) ?? [];
	bucket.push(row.tag);
	tagsByNode.set(row.node_id, bucket);
}

const markdown = new Map();
for (const n of v3Nodes) {
	const frontmatter = [
		'---',
		`id: ${n.id}`,
		`type: ${n.type}`,
		`slug: ${n.slug}`,
		`lang: ${n.lang}`,
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
		`tags: ${JSON.stringify(stable(tagsByNode.get(String(n.id)) ?? []))}`,
		`fields: ${JSON.stringify(stable(fieldsByNode.get(String(n.id)) ?? {}))}`,
		'---',
		''
	].join('\n');
	markdown.set(
		`nodes/${n.type}/${n.slug}.${n.lang}.md`,
		frontmatter + String(n.body_md ?? '')
	);
}

// Write the v3 bundle.
rmSync(OUT, { recursive: true, force: true });

const files = {
	'schema.json': JSON.stringify(
		{
			...schema,
			version: 3,
			db_schema: '3',
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
		},
		null,
		2
	),
	'nodes.jsonl': toJsonl(v3Nodes),
	'node_fields.jsonl': toJsonl(fieldRows),
	'node_tags.jsonl': toJsonl(tagRows),
	'media.jsonl': toJsonl(media),
	'relations.jsonl': read('relations.jsonl'),
	'events.jsonl': read('events.jsonl'),
	'event_status.jsonl': read('event_status.jsonl'),
	'actors.jsonl': read('actors.jsonl'),
	'actor_identities.jsonl': read('actor_identities.jsonl')
};

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

// Media binaries are copied as-is (content-addressed keys do not change).
const mediaDir = join(IN, 'media');
try {
	for (const name of readdirSync(mediaDir)) {
		const from = join(mediaDir, name);
		if (!statSync(from).isFile()) continue;
		const to = join(OUT, 'media', name);
		mkdirSync(dirname(to), { recursive: true });
		writeFileSync(to, readFileSync(from));
	}
} catch {
	/* no media directory */
}

console.log(`Converted ${v3Nodes.length} nodes: ${IN} → ${OUT}`);
console.log(`  fields: ${fieldRows.length}`);
console.log(`  tags:   ${tagRows.length}`);
console.log(`  media:  ${media.length}`);
