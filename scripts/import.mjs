#!/usr/bin/env node
/**
 * One-off content migration: existing markdown → the content API.
 *
 * Requires a running server (local dev or deployed) that exposes
 * `POST /api/admin/import` and an ADMIN_TOKEN.
 *
 *   ADMIN_TOKEN=xxx pnpm dev            # in one terminal
 *   ADMIN_TOKEN=xxx pnpm content:import # in another
 *
 * Frontmatter contract (v3):
 *   - `title`, `description`, `date`, `updated`, `draft`, `tags` are core
 *   - any other key is passed through as a declared field (`fields`), so a site
 *     can carry type-specific attributes (e.g. `rating`, `ageMonths`)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const API = process.env.API_URL ?? 'http://localhost:5173';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const REPLACE = process.argv.includes('--replace');
/** Optional: `--only=project` limits the import to one content type. */
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] ?? '';

const SOURCES = [
	{ dir: 'src/content/posts', type: 'post' },
	{ dir: 'src/content/notes', type: 'note' }
];

/** Frontmatter keys that map to columns, not declared fields. */
const CORE_KEYS = new Set(['title', 'description', 'date', 'updated', 'draft', 'tags']);

/**
 * A stable opaque id per logical work, so its locale variants share a group
 * (translations). Node ids are generated server-side; import is keyed on
 * `(type, slug, lang)`.
 * @type {Map<string, string>}
 */
const groupIds = new Map();
function groupFor(key) {
	if (!groupIds.has(key)) groupIds.set(key, crypto.randomUUID());
	return groupIds.get(key);
}

/** Minimal frontmatter parser for the shapes used in this repo. */
function parseFrontmatter(raw) {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { data: {}, body: raw };
	const data = {};
	for (const line of match[1].split('\n')) {
		const idx = line.indexOf(':');
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 1).trim();
		if (!key) continue;
		if (value.startsWith('[') || value.startsWith('"') || value.startsWith('{')) {
			try {
				data[key] = JSON.parse(value);
				continue;
			} catch {
				/* fall through */
			}
		}
		if (value === 'true' || value === 'false') {
			data[key] = value === 'true';
			continue;
		}
		data[key] = value.replace(/^["']|["']$/g, '');
	}
	return { data, body: raw.slice(match[0].length) };
}

function toIsoDate(value) {
	if (!value || typeof value !== 'string') return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function slugFromFile(file, fallbackLang) {
	const base = file.replace(/\.md$/, '');
	const parts = base.split('.');
	if (parts.length >= 2) return { slug: parts.slice(0, -1).join('.'), lang: parts[parts.length - 1] };
	return { slug: base, lang: fallbackLang };
}

/** Everything that is not a core key becomes a declared field. */
function extraFields(data) {
	const fields = {};
	for (const [key, value] of Object.entries(data)) {
		if (!CORE_KEYS.has(key)) fields[key] = value;
	}
	return fields;
}

async function main() {
	const lang = process.env.IMPORT_LANG ?? 'zh';
	const nodes = [];

	for (const source of SOURCES) {
		const dir = join(ROOT, source.dir);
		let files;
		try {
			files = readdirSync(dir).filter((f) => f.endsWith('.md'));
		} catch {
			continue; // source directory is optional
		}
		for (const file of files) {
			const raw = readFileSync(join(dir, file), 'utf8');
			const { data, body } = parseFrontmatter(raw);
			const slugged = slugFromFile(file, lang);
			const date = toIsoDate(data.date) ?? new Date().toISOString();
			const draft = data.draft === true;
			nodes.push({
				type: source.type,
				slug: slugged.slug,
				lang: slugged.lang,
				groupId: groupFor(`${source.type}:${slugged.slug}`),
				title: String(data.title ?? slugged.slug),
				summary: String(data.description ?? ''),
				bodyMd: body.trimStart(),
				status: draft ? 'draft' : 'published',
				publishedAt: date,
				tags: Array.isArray(data.tags) ? data.tags : [],
				fields: extraFields(data)
			});
		}
	}

	const selected = ONLY ? nodes.filter((n) => n.type === ONLY) : nodes;

	// Translations are derived from `groupId` at read time, so batching is safe
	// and no relation rows are written.
	const BATCH = Number(process.env.IMPORT_BATCH ?? 8);
	let total = 0;
	for (let i = 0; i < selected.length; i += BATCH) {
		const chunk = selected.slice(i, i + BATCH);
		const res = await fetch(`${API}/api/admin/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
			body: JSON.stringify({ nodes: chunk, replace: REPLACE })
		});

		if (!res.ok) {
			console.error(`Import failed at batch ${i / BATCH + 1}: ${res.status} ${res.statusText}`);
			console.error(await res.text());
			process.exit(1);
		}
		const result = await res.json();
		total += result.count ?? 0;
		process.stdout.write(`\r  imported ${total}/${selected.length}…`);
	}

	console.log(`\nImported ${total} nodes → ${API}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
