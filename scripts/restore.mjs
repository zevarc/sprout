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
// SvelteKit rejects cross-site form POSTs, so the multipart media upload must
// declare the site's own origin even though this script runs outside a browser.
const ORIGIN = new URL(API).origin;
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
console.log(`  people: ${result.people ?? result.actors}`);
console.log(`  comments: ${result.comments ?? result.events}`);
console.log(`  reactions: ${result.reactions ?? 0}`);
console.log(`  tags: ${result.tags ?? 0}`);
if (Array.isArray(result.warnings) && result.warnings.length > 0) {
	console.log(`  warnings (${result.warnings.length}):`);
	for (const warning of result.warnings) console.log(`    · ${warning}`);
}

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
/** @type {string[]} */
const failedMedia = [];
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
			headers: { Authorization: `Bearer ${TOKEN}`, Origin: ORIGIN },
			body: form
		});
		if (upload.ok) mediaCount++;
		else failedMedia.push(`${name} (${upload.status})`);
	}
}
console.log(`  media: ${mediaCount}`);
if (failedMedia.length > 0) {
	// A partial restore is a broken site: the binaries never reached R2.
	console.error(`  media upload failed for ${failedMedia.length} object(s):`);
	for (const item of failedMedia) console.error(`    · ${item}`);
	process.exitCode = 1;
}
