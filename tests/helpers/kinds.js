/**
 * Config-driven test fixtures for the content kinds.
 *
 * Engine tests must not assume the template's demo kinds, so anything that needs
 * "a kind with real columns" asks for one here. `kindWithFields()` returns the
 * declared kind with the most fields, which keeps the choice deterministic and
 * meaningful in any site (the template gets `project`, fuxi gets `toy`).
 */

import { listTypes } from '$lib/content/registry';
import { kindTable } from '$lib/server/repositories/assets';

/** The declared kind with the most fields. */
export function kindWithFields() {
	const kinds = listTypes().filter((t) => (t.fields ?? []).length > 0);
	if (kinds.length === 0) throw new Error('this site declares no content kind with fields');
	return [...kinds].sort((a, b) => b.fields.length - a.fields.length || a.type.localeCompare(b.type))[0];
}

/**
 * Declared fields whose value survives a database round trip unchanged: strings
 * and numbers. `boolean` comes back as 1/0 and `tags` is a relation, so both are
 * excluded from the comparisons this helper is used for.
 *
 * @param {ReturnType<typeof kindWithFields>} kind
 * @param {number} count
 */
export function roundTripFields(kind, count = 2) {
	return (kind.fields ?? [])
		.filter((f) => f.type !== 'boolean' && f.type !== 'tags')
		.slice(0, count);
}

/** A valid value for a declared field. @param {import('$lib/content/schema').FieldDef} field */
export function sampleValue(field) {
	switch (field.type) {
		case 'number':
			return 42;
		case 'select':
			return field.options?.[0]?.value ?? 'x';
		case 'date':
			return '2026-01-01';
		default:
			return `sample-${field.key}`;
	}
}

/** `{ field: value }` for the given declared fields. @param {import('$lib/content/schema').FieldDef[]} fields */
export function sampleFields(fields) {
	/** @type {Record<string, unknown>} */
	const out = {};
	for (const field of fields) out[field.key] = sampleValue(field);
	return out;
}

export { kindTable };
