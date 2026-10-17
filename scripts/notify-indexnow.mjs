#!/usr/bin/env node
/**
 * 向 IndexNow (Bing / Yandex / Seznam) 提交站点 URL，触发即时索引。
 * 可选功能：需要环境变量 INDEXNOW_KEY，并在 static/ 放一个 <KEY>.txt（内容就是 key）。
 * sitemap 是动态路由，因此从线上站点抓取。
 * 用法: INDEXNOW_KEY=xxxx BASE_URL=https://your-domain.com node scripts/notify-indexnow.mjs
 */
import { site } from '../src/site.config.js';

const BASE = (process.env.BASE_URL ?? site.url).replace(/\/$/, '');
const HOST = new URL(site.url).hostname;
const KEY = process.env.INDEXNOW_KEY ?? '';

if (!KEY) {
	console.log('INDEXNOW_KEY 未设置，跳过 IndexNow 提交（这是可选功能）。');
	process.exit(0);
}

const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : 10000;

const res = await fetch(`${BASE}/sitemap.xml`);
if (!res.ok) {
	console.error(`Could not fetch ${BASE}/sitemap.xml (${res.status}).`);
	process.exit(1);
}

const xml = await res.text();
const urls = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))].slice(0, limit);

if (urls.length === 0) {
	console.error('No URLs found in sitemap.');
	process.exit(1);
}

console.log(`Submitting ${urls.length} URLs to IndexNow (key: ${KEY.slice(0, 6)}…)...`);

const response = await fetch('https://api.indexnow.org/indexnow', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json; charset=utf-8' },
	body: JSON.stringify({
		host: HOST,
		key: KEY,
		keyLocation: KEY_LOCATION,
		urlList: urls
	})
});

console.log(`IndexNow API: ${response.status} ${response.statusText}`);
if (!response.ok) {
	console.error(await response.text());
	process.exit(1);
}
console.log(`Done. Key file: ${KEY_LOCATION}`);
