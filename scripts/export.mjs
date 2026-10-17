#!/usr/bin/env node
/**
 * Exports the canonical content bundle to a local directory (the git mirror).
 *
 *   ADMIN_TOKEN=xxx API_URL=http://localhost:5173 pnpm content:export [dir]
 *
 * Output is deterministic, so repeated exports produce clean git diffs.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const API = process.env.API_URL ?? 'http://localhost:5173';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'export';

// Prune first so the mirror is an exact snapshot — otherwise files for deleted
// content linger and `content:verify` reports false drift.
const target = resolve(DIR);
if (target === process.cwd() || target === resolve('/') || target === resolve(homedir())) {
	console.error(`Refusing to export into ${target} — that would wipe the directory.`);
	process.exit(1);
}
rmSync(target, { recursive: true, force: true });

const res = await fetch(`${API}/api/admin/export`, {
	headers: { Authorization: `Bearer ${TOKEN}` }
});

if (!res.ok) {
	console.error(`Export failed: ${res.status} ${res.statusText}`);
	console.error(await res.text());
	process.exit(1);
}

const bundle = await res.json();
let bytes = 0;
for (const file of bundle.files) {
	const target = join(DIR, file.path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, file.content);
	bytes += Buffer.byteLength(file.content);
}

// Media binaries: fetched from our own /media/<key> route so the export is
// self-contained and bucket-agnostic.
const mediaLine = bundle.files.find((f) => f.path === 'media.jsonl');
let mediaCount = 0;
if (mediaLine && !process.argv.includes('--no-media')) {
	for (const line of mediaLine.content.split('\n').filter(Boolean)) {
		const item = JSON.parse(line);
		const mediaRes = await fetch(`${API}/media/${item.r2_key}`);
		if (!mediaRes.ok) continue;
		const buffer = Buffer.from(await mediaRes.arrayBuffer());
		const target = join(DIR, 'media', item.r2_key);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, buffer);
		bytes += buffer.length;
		mediaCount++;
	}
}

console.log(`Exported ${bundle.files.length} files → ${DIR}/`);
console.log(`  nodes: ${bundle.nodeCount}`);
console.log(`  events: ${bundle.eventCount}`);
console.log(`  media: ${mediaCount}`);
console.log(`  bytes: ${bytes}`);
