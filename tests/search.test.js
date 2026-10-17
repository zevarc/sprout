import { describe, it, expect } from 'vitest';
import { tokenize, toMatchExpression } from '$lib/server/search';

describe('search tokenizer', () => {
	it('indexes a 2-character CJK word as one bigram', () => {
		expect(tokenize('构建')).toBe('构建');
	});

	it('indexes longer CJK runs as overlapping bigrams', () => {
		expect(tokenize('构建配置')).toBe('构建 建配 配置');
	});

	it('lowercases latin words', () => {
		expect(tokenize('Hello World')).toBe('hello world');
	});

	it('mixes latin and CJK', () => {
		expect(tokenize('Android 构建')).toBe('android 构建');
	});

	it('builds an AND match expression', () => {
		expect(toMatchExpression('构建配置')).toBe('"构建" AND "建配" AND "配置"');
	});

	it('returns an empty expression for blank queries', () => {
		expect(toMatchExpression('   ')).toBe('');
	});
});
