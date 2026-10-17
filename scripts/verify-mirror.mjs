#!/usr/bin/env node
/**
 * Verifies that the live database still matches the last exported mirror.
 * A drift here means something changed without being exported — the signal
 * that the git mirror is stale.
 *
 *   ADMIN_TOKEN=xxx API_URL=http://localhost:5173 pnpm content:verify [dir]
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const API = process.env.API_URL ?? 'http://localhost:5173';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const DIR = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'export';

/** @param {string} dir */
function collectFiles(dir, base = dir) {
	const files = new Map();
	for (const entry of readdirSync(dir)) {
		if (entry === 'media') continue; // binaries verified separately
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			for (const [k, v] of collectFiles(full, base)) files.set(k, v);
		} else {
			files.set(relative(base, full), readFileSync(full, 'utf8'));
		}
	}
	return files;
}

if (!existsSync(DIR)) {
	console.error(`Mirror directory "${DIR}" not found. Run content:export first.`);
	process.exit(1);
}

const res = await fetch(`${API}/api/admin/export`, {
	headers: { Authorization: `Bearer ${TOKEN}` }
});
if (!res.ok) {
	console.error(`Export failed: ${res.status} ${res.statusText}`);
	process.exit(1);
}

const bundle = await res.json();
const local = collectFiles(DIR);

let drift = 0;
for (const file of bundle.files) {
	const existing = local.get(file.path);
	if (existing === undefined) {
		console.warn(`missing in mirror: ${file.path}`);
		drift++;
	} else if (existing !== file.content) {
		console.warn(`changed: ${file.path}`);
		drift++;
	}
}

for (const path of local.keys()) {
	if (!bundle.files.some((f) => f.path === path)) {
		console.warn(`extra in mirror: ${path}`);
		drift++;
	}
}

if (drift === 0) {
	console.log(`Mirror matches the database (${bundle.files.length} files).`);
} else {
	console.error(`Drift detected: ${drift} file(s) differ from the mirror.`);
	process.exit(1);
}
