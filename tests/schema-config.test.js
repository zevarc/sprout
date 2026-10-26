/**
 * The declaration is the column list (docs/DATA-MODEL.md §4.6).
 *
 * A kind's `fields` are its table's columns, so a declared field without a column
 * is a 500 on every read of that kind. This test turns that class of mistake into
 * a failing test instead of a runtime error, in any site.
 */

import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { listTypes } from '$lib/content/registry';
import { fieldColumn, kindColumns, kindTable } from '$lib/server/repositories/assets';

const { sqlite } = createTestDb();

const tables = new Set(
	/** @type {{ name: string }[]} */ (
		sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
	).map((r) => r.name)
);

/** @param {string} table */
function columnsOf(table) {
	return new Set(
		/** @type {{ name: string }[]} */ (sqlite.prepare(`PRAGMA table_info(${table})`).all()).map(
			(r) => r.name
		)
	);
}

describe('sprout.config ↔ schema', () => {
	it('every declared kind has a table whose columns cover the declaration', () => {
		for (const kind of listTypes()) {
			const table = kindTable(kind.type);
			expect(tables, `kind "${kind.type}" needs a table`).toContain(table);

			const columns = columnsOf(table);
			for (const field of kind.fields ?? []) {
				expect(
					[...columns],
					`kind "${kind.type}" declares "${field.key}", so ${table} needs a "${fieldColumn(field.key)}" column`
				).toContain(fieldColumn(field.key));
			}
			// The read path projects exactly this list, so every entry must exist.
			for (const column of kindColumns(kind.type)) {
				expect([...columns], `${kind.type} spine column "${column}"`).toContain(column);
			}
		}
	});

	it('every declared kind has its own search index', () => {
		for (const kind of listTypes()) {
			expect(tables, `kind "${kind.type}" needs ${kindTable(kind.type)}_fts`).toContain(
				`${kindTable(kind.type)}_fts`
			);
		}
	});

	it('public kinds have a single-segment route the generic list page can serve', () => {
		for (const kind of listTypes().filter((t) => t.public)) {
			expect(kind.route.startsWith('/'), `${kind.type} route`).toBe(true);
			expect(kind.route.replace(/^\//, '').includes('/'), `${kind.type} route`).toBe(false);
		}
	});
});
