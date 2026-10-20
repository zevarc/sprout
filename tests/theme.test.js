import { describe, it, expect } from 'vitest';
import { themeCss, resolveTheme, PRESETS } from '$lib/engine/theme';

describe('theme layer', () => {
	it('emits nothing for the classic theme with no overrides', () => {
		expect(themeCss('classic', {})).toBe('');
	});

	it('emits overrides as :root declarations', () => {
		const css = themeCss('classic', { '--color-bud': '#123456' });
		expect(css).toContain(':root{');
		expect(css).toContain('--color-bud:#123456;');
	});

	it('a named preset ships both light and dark token sets', () => {
		const css = themeCss('mono');
		expect(css).toContain('--color-paper');
		expect(css).toContain('@media (prefers-color-scheme: dark)');
	});

	it('overrides beat preset values in both modes', () => {
		const resolved = resolveTheme('mono', { '--color-bud': 'red' });
		expect(resolved.light['--color-bud']).toBe('red');
		expect(resolved.dark?.['--color-bud']).toBe('red');
	});

	it('classic relies on the base palette (no preset tokens)', () => {
		expect(Object.keys(PRESETS.classic.light)).toEqual([]);
	});

	it('ships a warm preset with light and dark sets', () => {
		expect(PRESETS.warm.light['--color-paper']).toBeDefined();
		expect(PRESETS.warm.dark?.['--color-paper']).toBeDefined();
		expect(themeCss('warm')).toContain('@media (prefers-color-scheme: dark)');
	});
});
