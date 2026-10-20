/**
 * In-memory D1 stand-in backed by Node's built-in SQLite.
 * Lets us test repositories / export / restore without Cloudflare.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Apply every migration, in filename order — the migrations directory is the
// single source of truth, so a new migration is picked up automatically.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url));
const SCHEMA = readdirSync(MIGRATIONS_DIR)
	.filter((name) => name.endsWith('.sql'))
	.sort()
	.map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
	.join('\n');

/**
 * @param {DatabaseSync} sqlite
 * @returns {import('../../src/lib/server/db').D1Database}
 */
function d1FromSqlite(sqlite) {
	/** @param {string} query */
	const prepare = (query) => {
		const stmt = sqlite.prepare(query);
		/** @type {any[]} */
		let bound = [];

		/** @type {any} */
		const api = {
			/** @param {...any} params */
			bind(...params) {
				bound = params;
				return api;
			},
			/** @param {string} [col] */
			async first(col) {
				const row = /** @type {Record<string, unknown> | undefined} */ (stmt.get(...bound));
				if (!row) return null;
				return col ? row[col] : row;
			},
			async all() {
				return { results: stmt.all(...bound), success: true, meta: {} };
			},
			async run() {
				const meta = stmt.run(...bound);
				return { results: [], success: true, meta };
			}
		};
		return api;
	};

	return {
		prepare,
		/** @param {any[]} statements */
		async batch(statements) {
			return Promise.all(statements.map((s) => s.all()));
		},
		/** @param {string} query */
		async exec(query) {
			sqlite.exec(query);
			return { count: 0, duration: 0 };
		}
	};
}

export function createTestDb() {
	const sqlite = new DatabaseSync(':memory:');
	// Enforce the schema's foreign keys so referential integrity is testable.
	sqlite.exec('PRAGMA foreign_keys = ON');
	sqlite.exec(SCHEMA);
	return { db: d1FromSqlite(sqlite), sqlite };
}
