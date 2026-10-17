#!/usr/bin/env node
/**
 * One-off content migration: existing markdown → the content API.
 *
 * Requires a running server (local dev or deployed) that exposes
 * `POST /api/admin/import` and an ADMIN_TOKEN.
 *
 *   ADMIN_TOKEN=xxx pnpm dev            # in one terminal
 *   ADMIN_TOKEN=xxx pnpm content:import # in another
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const API = process.env.API_URL ?? 'http://localhost:5173';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const REPLACE = process.argv.includes('--replace');

const SOURCES = [
	{ dir: 'src/content/posts', type: 'post' },
	{ dir: 'src/content/notes', type: 'note' }
];

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

function slugFromFile(file) {
	const base = file.replace(/\.md$/, '');
	const parts = base.split('.');
	if (parts.length >= 2) return { slug: parts.slice(0, -1).join('.'), lang: parts[parts.length - 1] };
	return { slug: base, lang: 'en' };
}

async function main() {
	const nodes = [];
	for (const source of SOURCES) {
		const dir = join(ROOT, source.dir);
		for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
			const raw = readFileSync(join(dir, file), 'utf8');
			const { data, body } = parseFrontmatter(raw);
			const { slug, lang } = slugFromFile(file);
			const date = toIsoDate(data.date) ?? new Date().toISOString();
			const updated = toIsoDate(data.updated) ?? date;
			const draft = data.draft === true;
			nodes.push({
				id: `${source.type}:${slug}:${lang}`,
				type: source.type,
				slug,
				lang,
				groupId: `${source.type}:${slug}`,
				title: String(data.title ?? slug),
				summary: String(data.description ?? ''),
				bodyMd: body.trimStart(),
				status: draft ? 'draft' : 'published',
				publishedAt: date,
				extra: {
					description: data.description ?? '',
					cover: data.cover ?? null,
					tags: Array.isArray(data.tags) ? data.tags : [],
					createdAt: date,
					updatedAt: updated
				}
			});
		}
	}

	// Projects were migrated out of the i18n dictionaries; their seed data now
	// lives in scripts/seed-projects.json.
	const seedProjects = JSON.parse(
		readFileSync(join(ROOT, 'scripts/seed-projects.json'), 'utf8')
	);

	for (const project of seedProjects) {
		const common = {
			type: 'project',
			slug: project.slug,
			groupId: `project:${project.slug}`,
			publishedAt: `${project.year ?? '2026'}-01-01T00:00:00.000Z`
		};
		const build = (lang, data, tags) => ({
			...common,
			id: `project:${project.slug}:${lang}`,
			lang,
			title: data.title,
			summary: data.description ?? '',
			bodyMd: data.description ?? '',
			status: 'published',
			extra: {
				year: project.year ?? '',
				description: data.description ?? '',
				image: project.image ?? null,
				tags: tags ?? [],
				website: project.website ?? null,
				github: project.github ?? null,
				order: project.order
			}
		});
		nodes.push(build('en', project.en, project.tags));
		nodes.push(build('zh', project.zh, project.zhTags ?? project.tags));
	}

	// Relations are derived server-side from groupId, so batching is safe.
	// Batch to stay within Workers CPU limits while rendering markdown.
	const BATCH = Number(process.env.IMPORT_BATCH ?? 8);
	let total = 0;
	let relations = 0;
	for (let i = 0; i < nodes.length; i += BATCH) {
		const chunk = nodes.slice(i, i + BATCH);
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
		relations += result.relations ?? 0;
		process.stdout.write(`\r  imported ${total}/${nodes.length}…`);
	}

	console.log(`\nImported ${total} nodes → ${API}`);
	console.log(`  posts: ${nodes.filter((n) => n.type === 'post').length}`);
	console.log(`  notes: ${nodes.filter((n) => n.type === 'note').length}`);
	console.log(`  projects: ${nodes.filter((n) => n.type === 'project').length}`);
	console.log(`  relations written: ${relations}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
