import { describe, it, expect } from 'vitest';
import {
	coerceFieldValue,
	initialFieldValues,
	normalizeTags,
	validateFields
} from '$lib/engine/fields';

const FIELDS = /** @type {import('$lib/content/schema').FieldDef[]} */ ([
	{
		key: 'rating',
		label: { zh: '推荐度' },
		type: 'select',
		options: [
			{ value: '1', label: { zh: '差' } },
			{ value: '5', label: { zh: '好' } }
		]
	},
	{ key: 'ageMonths', label: { zh: '月龄' }, type: 'number' },
	{ key: 'pros', label: { zh: '优点' }, type: 'textarea' },
	{ key: 'sturdy', label: { zh: '结实' }, type: 'boolean' },
	{ key: 'keywords', label: { zh: '关键词' }, type: 'tags' }
]);

describe('declarative fields', () => {
	it('normalizes form input into typed values', () => {
		const result = validateFields(FIELDS, {
			rating: '5',
			ageMonths: '12',
			pros: '耐摔',
			sturdy: true,
			keywords: '积木, 益智'
		});

		expect(result.ok).toBe(true);
		expect(result.value).toEqual({
			rating: '5',
			ageMonths: 12,
			pros: '耐摔',
			sturdy: true,
			keywords: ['积木', '益智']
		});
	});

	it('rejects an unknown field key (typos must not vanish)', () => {
		const result = validateFields(FIELDS, { raiting: '5' });
		expect(result.ok).toBe(false);
		expect(result.errors.join(' ')).toContain('unknown field "raiting"');
	});

	it('rejects a select value outside its options', () => {
		const result = validateFields(FIELDS, { rating: '五星' });
		expect(result.ok).toBe(false);
		expect(result.errors.join(' ')).toContain('rating must be one of');
	});

	it('rejects a non-numeric number', () => {
		const result = validateFields(FIELDS, { ageMonths: 'abc' });
		expect(result.ok).toBe(false);
		expect(result.errors.join(' ')).toContain('ageMonths must be a number');
	});

	it('enforces required fields and omits empty optional ones', () => {
		/** @type {import('$lib/content/schema').FieldDef[]} */
		const required = [
			...FIELDS,
			{ key: 'title', label: { zh: '标题' }, type: 'text', required: true }
		];
		const missing = validateFields(required, { pros: '' });
		expect(missing.ok).toBe(false);
		expect(missing.errors.join(' ')).toContain('title is required');
		expect(missing.value.pros).toBeUndefined();

		const filled = validateFields(required, { title: '积木' });
		expect(filled.ok).toBe(true);
		expect(filled.value).toEqual({ title: '积木' });
	});

	it('gives form state sane defaults', () => {
		const values = initialFieldValues(FIELDS, { rating: '5', keywords: ['a'] });
		expect(values.rating).toBe('5');
		expect(values.keywords).toEqual(['a']);
		expect(values.sturdy).toBe(false);
		expect(values.pros).toBe('');
		expect(values.ageMonths).toBe('');
	});

	it('coerces booleans from form strings', () => {
		/** @type {import('$lib/content/schema').FieldDef} */
		const field = { key: 'x', label: {}, type: 'boolean' };
		expect(coerceFieldValue(field, 'true')).toBe(true);
		expect(coerceFieldValue(field, '1')).toBe(true);
		expect(coerceFieldValue(field, false)).toBe(false);
	});

	it('normalizes and de-duplicates tags', () => {
		expect(normalizeTags('a, b ,a')).toEqual(['a', 'b']);
		expect(normalizeTags(['a', ' a ', 'b'])).toEqual(['a', 'b']);
		expect(normalizeTags(undefined)).toEqual([]);
	});
});
