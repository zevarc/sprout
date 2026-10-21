/**
 * Declarative field handling for site-owned content types.
 *
 * `sprout.config.js` declares a type's `fields`; this module is the single
 * place that turns form/API input into typed values and validates it. The
 * admin editor renders from the same declarations, so the form and the write
 * boundary can never drift apart.
 */

import type { FieldDef } from '$lib/content/schema';

export type FieldValues = Record<string, unknown>;

function isEmpty(value: unknown): boolean {
	return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/** Input (string from a form, or JSON from the API) → the field's typed value. */
export function coerceFieldValue(field: FieldDef, raw: unknown): unknown {
	switch (field.type) {
		case 'number': {
			if (isEmpty(raw)) return undefined;
			const n = typeof raw === 'number' ? raw : Number(raw);
			return Number.isFinite(n) ? n : undefined;
		}
		case 'boolean': {
			if (raw === undefined || raw === null) return undefined;
			if (typeof raw === 'boolean') return raw;
			if (raw === 'false' || raw === '0' || raw === 0) return false;
			return raw === true || raw === 'true' || raw === 1 || raw === '1';
		}
		case 'tags': {
			if (Array.isArray(raw)) {
				return raw.map((v) => String(v).trim()).filter(Boolean);
			}
			if (typeof raw === 'string') {
				return raw
					.split(',')
					.map((v) => v.trim())
					.filter(Boolean);
			}
			return [];
		}
		case 'select':
			return isEmpty(raw) ? undefined : String(raw);
		default:
			return isEmpty(raw) ? undefined : String(raw);
	}
}

/** Existing values → form state (typed, with sane defaults for inputs). */
export function initialFieldValues(
	fields: FieldDef[],
	values: Record<string, unknown> = {}
): FieldValues {
	const out: FieldValues = {};
	for (const field of fields) {
		const coerced = coerceFieldValue(field, values[field.key]);
		if (coerced !== undefined) out[field.key] = coerced;
		else if (field.type === 'boolean') out[field.key] = false;
		else if (field.type === 'tags') out[field.key] = [];
		else out[field.key] = '';
	}
	return out;
}

export interface FieldValidation {
	ok: boolean;
	errors: string[];
	/** Normalized values (only declared fields; empty optional values omitted). */
	value: FieldValues;
}

/**
 * The authoritative write-boundary check.
 *
 * - Unknown keys are an error (a typo surfaces immediately instead of vanishing).
 * - `select` values must be one of the declared options.
 * - `required` fields must be present.
 * - Numeric strings are accepted and normalized to numbers.
 */
export function validateFields(fields: FieldDef[], input: unknown): FieldValidation {
	const errors: string[] = [];
	const source =
		input && typeof input === 'object' && !Array.isArray(input)
			? (input as Record<string, unknown>)
			: {};

	const declared = new Set(fields.map((f) => f.key));
	for (const key of Object.keys(source)) {
		if (!declared.has(key)) errors.push(`unknown field "${key}"`);
	}

	const value: FieldValues = {};

	for (const field of fields) {
		const raw = source[field.key];
		const coerced = coerceFieldValue(field, raw);

		if (field.type === 'number' && !isEmpty(raw) && coerced === undefined) {
			errors.push(`${field.key} must be a number`);
			continue;
		}
		if (
			field.type === 'select' &&
			coerced !== undefined &&
			!(field.options ?? []).some((o) => o.value === String(coerced))
		) {
			const allowed = (field.options ?? []).map((o) => `"${o.value}"`).join(', ');
			errors.push(`${field.key} must be one of ${allowed}`);
			continue;
		}

		const empty = coerced === undefined || (Array.isArray(coerced) && coerced.length === 0);
		if (empty) {
			if (field.required) errors.push(`${field.key} is required`);
			continue;
		}
		value[field.key] = coerced;
	}

	return { ok: errors.length === 0, errors, value };
}

/** Coerces a tag list from either an array or a comma-separated string. */
export function normalizeTags(raw: unknown): string[] {
	if (Array.isArray(raw)) return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))];
	if (typeof raw === 'string') {
		return [...new Set(raw.split(',').map((v) => v.trim()).filter(Boolean))];
	}
	return [];
}
