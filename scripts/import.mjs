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
 *   - `cover` is not a column: the file under `static/` is uploaded and bound as
 *     `asset_media.role='cover'` (docs/DATA-MODEL.md §4.10). It stays in the
 *     markdown so a fresh environment can bootstrap its covers from source,
 *     exactly like `tags` bootstraps `tag` rows.
 *   - any other key is passed through as a declared field (`fields`), so a site
 *     can carry type-specific attributes (e.g. `rating`, `ageMonths`); keys the
 *     type does not declare are reported and skipped instead of failing the batch
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const API = process.env.API_URL ?? 'http://localhost:5173';
/**
 * SvelteKit's CSRF guard rejects form POSTs that do not declare the site's own
 * origin, and this script runs outside a browser. Mirror `restore.mjs`.
 */
const ORIGIN = new URL(API).origin;
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const REPLACE = process.argv.includes('--replace');
/** Optional: `--only=project` limits the import to one content type. */
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1] ?? '';

const SOURCES = [
	{ dir: 'src/content/posts', type: 'post' },
	{ dir: 'src/content/notes', type: 'note' }
];

/** `--skip-covers` for stores whose media bucket is not reachable from here. */
const SKIP_COVERS = process.argv.includes('--skip-covers');

/** MIME types the admin media endpoint accepts. */
const MIME = {
	webp: 'image/webp',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

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

/**
 * Everything that is not a core key becomes a declared field — but only if the
 * type declares it. Migration sources keep their old generator's front matter
 * (`cover`, `slug`, `summary`…), and the API rejects unknown columns, so sending
 * them would abort the whole import over metadata that is not representable.
 *
 * @param {Record<string, unknown>} data
 * @param {Set<string> | null} declared keys the type actually has
 * @param {(key: string) => void} [onIgnored]
 */
function extraFields(data, declared, onIgnored) {
	const fields = {};
	for (const [key, value] of Object.entries(data)) {
		if (CORE_KEYS.has(key)) continue;
		if (declared && !declared.has(key)) {
			onIgnored?.(key);
			continue;
		}
		fields[key] = value;
	}
	return fields;
}

/**
 * The instance's declared fields, per type. Missing file (or a bare engine
 * checkout) means "send everything", i.e. the previous behaviour.
 * @returns {Promise<Record<string, Set<string>> | null>}
 */
async function declaredFields() {
	try {
		const { contentTypes } = await import(join(ROOT, 'src/site/assembly.js'));
		/** @type {Record<string, Set<string>>} */
		const out = {};
		for (const [type, def] of Object.entries(contentTypes ?? {})) {
			out[type] = new Set((def.fields ?? []).map((field) => field.key));
		}
		return out;
	} catch {
		return null;
	}
}

/**
 * Upload a `cover:` path and bind it as the asset's cover.
 *
 * `cover` is **not** a column: a cover is `asset_media.role = 'cover'`
 * (docs/DATA-MODEL.md §4.10), so it goes through the media endpoint — the same
 * one the admin UI uses. Media is content-addressed (sha256), so a repeated
 * import re-binds the same object instead of uploading a duplicate.
 *
 * @param {string} assetId
 * @param {string} coverPath source path: `/foo.webp` is a published asset under
 *   `static/`, anything else is a repo-relative source file (e.g.
 *   `src/content/media/covers/x.webp`, which is not shipped as an asset)
 * @param {string} title used as the image's alt text
 * @param {string | null} currentKey the cover object key the node already has
 * @returns {Promise<'bound' | 'unchanged' | 'missing' | 'external' | `failed ${number}: ${string}`>}
 */
async function attachCover(assetId, coverPath, title, currentKey) {
	const value = String(coverPath);
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return 'external';

	const file = value.startsWith('/')
		? join(ROOT, 'static', value.slice(1))
		: join(ROOT, value);
	/** @type {Buffer} */
	let buffer;
	try {
		buffer = readFileSync(file);
	} catch {
		return 'missing';
	}
	const ext = file.split('.').pop()?.toLowerCase() ?? '';
	const type = MIME[ext];
	if (!type) return 'missing';

	// Media is content-addressed: if the asset's cover key already starts with
	// this file's hash, the object on the server is this exact file.
	const sha256 = createHash('sha256').update(buffer).digest('hex');
	if (currentKey && currentKey.startsWith(`${sha256}.`)) return 'unchanged';

	const form = new FormData();
	form.append('file', new Blob([buffer], { type }), file.split('/').pop() ?? 'cover');
	form.append('assetId', assetId);
	form.append('role', 'cover');
	form.append('position', '0');
	form.append('alt', title);

	const res = await fetch(`${API}/api/admin/media`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
		body: form
	});
	if (res.ok) return 'bound';
	const detail = (await res.text()).slice(0, 120).replace(/\s+/g, ' ').trim();
	return `failed ${res.status}${detail ? `: ${detail}` : ''}`;
}

async function main() {
	const lang = process.env.IMPORT_LANG ?? 'zh';
	const declared = await declaredFields();
	/** @type {Map<string, number>} */
	const ignored = new Map();
	/** @type {{ payload: Record<string, unknown>, cover: string | null }[]} */
	const jobs = [];

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
			// A cover is media, not a field — unless the type really declares one.
			const declaresCover = declared?.[source.type]?.has('cover') ?? false;
			const cover =
				!declaresCover && typeof data.cover === 'string' && data.cover.trim()
					? data.cover.trim()
					: null;
			if (cover) delete data.cover;
			const fields = extraFields(
				data,
				declared?.[source.type] ?? null,
				(key) => ignored.set(key, (ignored.get(key) ?? 0) + 1)
			);
			jobs.push({
				cover,
				payload: {
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
					fields
				}
			});
		}
	}

	const selected = ONLY ? jobs.filter((job) => job.payload.type === ONLY) : jobs;

	// Translations are derived from `groupId` at read time, so batching is safe
	// and no relation rows are written.
	const BATCH = Number(process.env.IMPORT_BATCH ?? 8);
	let total = 0;
	/** @type {{ bound: number, unchanged: number, missing: string[], external: string[], failed: string[] }} */
	const covers = { bound: 0, unchanged: 0, missing: [], external: [], failed: [] };

	for (let i = 0; i < selected.length; i += BATCH) {
		const chunk = selected.slice(i, i + BATCH);
		const res = await fetch(`${API}/api/admin/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
			body: JSON.stringify({ nodes: chunk.map((job) => job.payload), replace: REPLACE })
		});

		if (!res.ok) {
			console.error(`Import failed at batch ${i / BATCH + 1}: ${res.status} ${res.statusText}`);
			console.error(await res.text());
			process.exit(1);
		}
		const result = await res.json();
		total += result.count ?? 0;

		// `ids` is aligned with the batch order, which is why covers are bound
		// here and not in a second pass keyed on slugs.
		const ids = /** @type {string[]} */ (result.ids ?? []);
		const keys = /** @type {(string | null)[]} */ (result.covers ?? []);
		if (!SKIP_COVERS) {
			for (let j = 0; j < chunk.length; j++) {
				const { cover, payload } = chunk[j];
				const id = ids[j];
				if (!cover || !id) continue;
				const outcome = await attachCover(id, cover, String(payload.title ?? ''), keys[j] ?? null);
				const where = `${payload.type}/${payload.slug}.${payload.lang}`;
				if (outcome === 'bound') covers.bound += 1;
				else if (outcome === 'unchanged') covers.unchanged += 1;
				else if (outcome.startsWith('failed')) covers.failed.push(`${where} (${outcome.slice(7)})`);
				else covers[outcome].push(where);
			}
		}

		process.stdout.write(`\r  imported ${total}/${selected.length}…`);
	}

	if (
		covers.bound > 0 ||
		covers.unchanged > 0 ||
		covers.missing.length ||
		covers.external.length ||
		covers.failed.length
	) {
		console.log(`  covers bound: ${covers.bound}, already current: ${covers.unchanged}`);
		for (const [kind, list] of [
			['cover file not found', covers.missing],
			['cover is a remote URL (skipped)', covers.external],
			['cover upload failed', covers.failed]
		]) {
			if (list.length) console.warn(`  ${kind}: ${list.join(', ')}`);
		}
	}
	if (ignored.size > 0) {
		const list = [...ignored].map(([key, n]) => `${key} (${n})`).join(', ');
		console.warn(`  ignored front-matter keys the type does not declare: ${list}`);
	}
	console.log(`\nImported ${total} nodes → ${API}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
