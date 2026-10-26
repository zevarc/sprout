#!/usr/bin/env node
/**
 * Crawls a running origin and reports broken internal links, images and
 * scripts. Works against SSR pages (no build directory needed).
 *
 *   BASE_URL=http://localhost:5173 LIMIT=200 node scripts/check-links.mjs
 *
 * The seeds are the pages a site must have, taken from its own config: the home
 * page, its public type routes, and the built-in public pages. A site that has
 * no `project` type is therefore never asked for `/projects`.
 */
import { contentTypes, features } from '../src/sprout.config.js';

const BASE = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const LIMIT = Number(process.env.LIMIT ?? 200);

const SEEDS = [
	'/',
	'/about',
	'/search',
	'/tags',
	...(features ?? []).includes('timeline') ? ['/timeline'] : [],
	...Object.values(contentTypes)
		.filter((t) => t.public)
		.map((t) => t.route)
];

const seen = new Set();
const queue = [...SEEDS];
const assetChecked = new Set();
let errors = 0;
let pages = 0;

function internal(href) {
	if (!href) return null;
	if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
	if (href.startsWith('data:') || href.startsWith('blob:')) return null;
	try {
		const url = new URL(href, BASE);
		if (url.origin !== new URL(BASE).origin) return null;
		return url.pathname + url.search;
	} catch {
		return null;
	}
}

async function checkAsset(path) {
	if (assetChecked.has(path)) return;
	assetChecked.add(path);
	const res = await fetch(BASE + path);
	if (!res.ok) {
		console.error(`BROKEN ASSET: ${path} → ${res.status}`);
		errors++;
	}
}

while (queue.length > 0 && pages < LIMIT) {
	const path = queue.shift();
	if (seen.has(path)) continue;
	seen.add(path);

	const res = await fetch(BASE + path);
	if (!res.ok) {
		console.error(`BROKEN PAGE: ${path} → ${res.status}`);
		errors++;
		continue;
	}
	pages++;

	const html = await res.text();
	for (const m of html.matchAll(/href="([^"]+)"/g)) {
		const p = internal(m[1]);
		if (p && !seen.has(p) && !p.startsWith('/api')) queue.push(p);
	}
	for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
		const p = internal(m[1]);
		if (p) await checkAsset(p);
	}
	for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
		const p = internal(m[1]);
		if (p) await checkAsset(p);
	}
}

console.log(`Crawled ${pages} pages, checked ${assetChecked.size} assets, ${errors} broken.`);
process.exit(errors > 0 ? 1 : 0);
