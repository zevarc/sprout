#!/usr/bin/env node
/**
 * Validates that every URL in the live sitemap resolves.
 * Since the site is server-rendered, the sitemap is fetched from a running
 * origin rather than from a build directory.
 *
 *   BASE_URL=http://localhost:5173 node scripts/check-sitemap.mjs
 */
import { site } from '../src/site.config.js';

const BASE = (process.env.BASE_URL ?? site.url).replace(/\/$/, '');

const res = await fetch(`${BASE}/sitemap.xml`);
if (!res.ok) {
	console.error(`Could not fetch ${BASE}/sitemap.xml (${res.status})`);
	process.exit(1);
}

const xml = await res.text();
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

let missing = 0;
for (const loc of new Set(locs)) {
	const check = await fetch(loc, { method: 'GET' });
	if (!check.ok) {
		console.error(`MISSING: ${loc} → ${check.status}`);
		missing++;
	}
}

console.log(`Checked ${new Set(locs).size} unique URLs, ${missing} missing.`);
process.exit(missing > 0 ? 1 : 0);
