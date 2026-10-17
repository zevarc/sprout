#!/usr/bin/env node
/**
 * Restores the database from a local export bundle — the migration and
 * disaster-recovery path. Text records go through /api/admin/restore; media
 * binaries are re-uploaded to R2.
 *
 *   ADMIN_TOKEN=xxx API_URL=http://localhost:5173 pnpm content:restore [dir]
 *
 * Run against an empty database to bring a fresh environment up to date.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:5173';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'export';

const MEDIA_DIR = join(DIR, 'media');

/** Text records only — `media/` holds binary files handled separately. */
function collectTextFiles(dir, base = dir) {
	const files = [];
	for (const entry of readdirSync(dir)) {
		if (entry === 'media') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...collectTextFiles(full, base));
		} else {
			files.push({ path: relative(base, full), content: readFileSync(full, 'utf8') });
		}
	}
	return files;
}

const files = collectTextFiles(DIR);
const res = await fetch(`${API}/api/admin/restore`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
	body: JSON.stringify({ files })
});

if (!res.ok) {
	console.error(`Restore failed: ${res.status} ${res.statusText}`);
	console.error(await res.text());
	process.exit(1);
}

const result = await res.json();
console.log(`Restored from ${DIR}/ → ${API}`);
console.log(`  nodes: ${result.nodes}`);
console.log(`  events: ${result.events}`);
console.log(`  actors: ${result.actors}`);
console.log(`  relations: ${result.relations}`);

// Re-upload media binaries (metadata already restored from media.jsonl).
const MIME = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

let mediaCount = 0;
if (existsSync(MEDIA_DIR)) {
	for (const name of readdirSync(MEDIA_DIR)) {
		const full = join(MEDIA_DIR, name);
		if (!statSync(full).isFile()) continue;
		const ext = name.split('.').pop()?.toLowerCase() ?? '';
		const type = MIME[ext] ?? 'application/octet-stream';
		const form = new FormData();
		form.append('file', new Blob([readFileSync(full)], { type }), name);
		form.append('record', '0');
		const upload = await fetch(`${API}/api/admin/media`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${TOKEN}` },
			body: form
		});
		if (upload.ok) mediaCount++;
		else console.warn(`  media upload failed: ${name} (${upload.status})`);
	}
}
console.log(`  media: ${mediaCount}`);
