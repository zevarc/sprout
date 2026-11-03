#!/usr/bin/env node
/**
 * Local mock of the Cloudflare D1 HTTP API for testing blogs-sync without
 * real credentials. Executes statements against a local node:sqlite file.
 *
 *   node scripts/mock-d1.mjs [dbfile]   # listens on :8790
 */
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';

const file = process.argv[2] ?? '.mock-d1.sqlite';
const db = new DatabaseSync(file);
db.exec(`
CREATE TABLE IF NOT EXISTS discovered_blogs (
  id INTEGER PRIMARY KEY, url TEXT NOT NULL UNIQUE, feed_url TEXT,
  title TEXT, description TEXT, language TEXT, favicon_url TEXT,
  last_post_at TEXT, first_seen TEXT, latest_posts TEXT NOT NULL DEFAULT '[]',
  synced_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS discovered_picks (
  pick_date TEXT PRIMARY KEY,
  blog_id INTEGER NOT NULL REFERENCES discovered_blogs(id) ON DELETE CASCADE,
  synced_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
`);

createServer((req, res) => {
	let body = '';
	req.on('data', (c) => (body += c));
	req.on('end', () => {
		try {
			const { sql, params = [] } = JSON.parse(body);
			const stmt = db.prepare(sql);
			const isRead = /^\s*(SELECT|PRAGMA)/i.test(sql);
			const result = isRead ? stmt.all(...params) : stmt.run(...params);
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify({ success: true, result: [{ results: isRead ? result : [] }] }));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ success: false, errors: [{ message: err.message }] }));
		}
	});
}).listen(8790, () => console.log(`mock D1 on :8790 -> ${file}`));
