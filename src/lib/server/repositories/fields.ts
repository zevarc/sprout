/**
 * `node_fields` — type-specific attributes, one row per field.
 *
 * Four typed value columns, exactly one non-null (enforced by a CHECK). The
 * shape is generic: the *set* of allowed field names comes from the site's
 * `contentTypes[type].fields`, validated at the write boundary. Reading and
 * writing never needs a schema migration.
 */

import type { D1Database, D1PreparedStatement } from '$lib/server/db';
import { query } from '$lib/server/db';

export type FieldValueKind = 'text' | 'number' | 'bool' | 'json';

interface RawFieldRow {
	node_id: string;
	field: string;
	value_text: string | null;
	value_number: number | null;
	value_bool: number | null;
	value_json: string | null;
}

/** The value kind implied by a JavaScript value (used when no declared type is given). */
export function kindOf(value: unknown): FieldValueKind {
	if (typeof value === 'boolean') return 'bool';
	if (typeof value === 'number' && Number.isFinite(value)) return 'number';
	if (typeof value === 'string') return 'text';
	return 'json';
}

function decode(row: RawFieldRow): unknown {
	if (row.value_text !== null) return row.value_text;
	if (row.value_number !== null) return row.value_number;
	if (row.value_bool !== null) return row.value_bool === 1;
	if (row.value_json !== null) {
		try {
			return JSON.parse(row.value_json);
		} catch {
			return null;
		}
	}
	return null;
}

/** Loads fields for many nodes in one query, keyed by node id. */
export async function readFields(
	db: D1Database,
	nodeIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
	const out = new Map<string, Record<string, unknown>>();
	if (nodeIds.length === 0) return out;

	const placeholders = nodeIds.map(() => '?').join(', ');
	const rows = await query<RawFieldRow>(
		db,
		`SELECT node_id, field, value_text, value_number, value_bool, value_json
		   FROM node_fields
		  WHERE node_id IN (${placeholders})
		  ORDER BY node_id, field`,
		nodeIds
	);

	for (const row of rows) {
		const bucket = out.get(row.node_id) ?? {};
		bucket[row.field] = decode(row);
		out.set(row.node_id, bucket);
	}
	return out;
}

export interface FieldEntry {
	field: string;
	value: unknown;
	/** Override the inferred kind (restore passes the exported kind). */
	kind?: FieldValueKind;
}

/** Delete-then-insert statements that replace a node's fields. */
export function fieldStatements(
	db: D1Database,
	nodeId: string,
	fields: Record<string, unknown> | FieldEntry[]
): D1PreparedStatement[] {
	const entries: FieldEntry[] = Array.isArray(fields)
		? fields
		: Object.entries(fields).map(([field, value]) => ({ field, value }));

	const statements: D1PreparedStatement[] = [
		db.prepare('DELETE FROM node_fields WHERE node_id = ?').bind(nodeId)
	];

	for (const entry of entries) {
		if (entry.value === undefined || entry.value === null) continue;
		const kind = entry.kind ?? kindOf(entry.value);
		statements.push(
			db
				.prepare(
					`INSERT INTO node_fields (node_id, field, value_text, value_number, value_bool, value_json)
					 VALUES (?, ?, ?, ?, ?, ?)`
				)
				.bind(
					nodeId,
					entry.field,
					kind === 'text' ? String(entry.value) : null,
					kind === 'number' ? Number(entry.value) : null,
					kind === 'bool' ? (entry.value ? 1 : 0) : null,
					kind === 'json' ? JSON.stringify(entry.value) : null
				)
		);
	}

	return statements;
}

/** Every field row for the export, deterministically ordered. */
export async function exportFieldRows(db: D1Database): Promise<Record<string, unknown>[]> {
	const rows = await query<RawFieldRow>(
		db,
		`SELECT node_id, field, value_text, value_number, value_bool, value_json
		   FROM node_fields
		  ORDER BY node_id, field`
	);
	return rows.map((row) => ({
		node_id: row.node_id,
		field: row.field,
		kind: kindOfRow(row),
		value: decode(row)
	}));
}

function kindOfRow(row: RawFieldRow): FieldValueKind {
	if (row.value_text !== null) return 'text';
	if (row.value_number !== null) return 'number';
	if (row.value_bool !== null) return 'bool';
	return 'json';
}
