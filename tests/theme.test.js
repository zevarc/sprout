import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { themeCss, resolveTheme, resolvePalette, PRESETS } from '$lib/engine/theme';

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

/**
 * The palette is the contract: every token pair that carries text has to clear
 * WCAG AA (4.5:1). Derived tokens (color-mix) are checked by eye; these are the
 * base pairs whose hex values live in `variables.css`.
 */
describe('palette contrast (WCAG AA)', () => {
	const css = readFileSync(new URL('../src/styles/variables.css', import.meta.url), 'utf8');
	const darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
	const light = css.slice(0, darkAt);
	const dark = css.slice(darkAt);

	/**
	 * Reads a base token, following one level of `var(--color-…)` so derived
	 * aliases (e.g. `--color-action-bg: var(--color-bud-deep)`) resolve.
	 * @param {string} block @param {string} name
	 */
	function token(block, name) {
		const raw = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
		if (!raw) throw new Error(`token --color-${name} not found`);

		const alias = /^var\(--color-([a-z0-9-]+)\)$/.exec(raw);
		if (alias) return token(block, alias[1]);

		if (!/^#[0-9a-fA-F]{3,8}$/.test(raw)) {
			throw new Error(`token --color-${name} is not a hex colour: ${raw}`);
		}
		return raw;
	}

	/** @param {string} hex */
	function luminance(hex) {
		const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
		const linear = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
	}

	/** @param {string} fg @param {string} bg */
	function contrast(fg, bg) {
		const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
		return (a + 0.05) / (b + 0.05);
	}

	const PAIRS = [
		['ink', 'paper'],
		['ink-soft', 'paper'],
		['ink-faint', 'paper'],
		['bud-deep', 'paper'],
		['pill-ink', 'pill-bg'],
		['action-bg', 'action-ink'],
		['on-primary-container', 'primary-container'],
		['error', 'paper']
	];

	it('light mode text pairs clear 4.5:1', () => {
		for (const [fg, bg] of PAIRS) {
			const ratio = contrast(token(light, fg), token(light, bg));
			expect(ratio, `--color-${fg} on --color-${bg}`).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('dark mode text pairs clear 4.5:1', () => {
		for (const [fg, bg] of PAIRS) {
			const ratio = contrast(token(dark, fg), token(dark, bg));
			expect(ratio, `--color-${fg} on --color-${bg} (dark)`).toBeGreaterThanOrEqual(4.5);
		}
	});
});

/**
 * Presets ship their own paper/ink/accent values, so they need the same guard:
 * a theme that looks calm but renders 3:1 meta text is still broken.
 */
describe('preset contrast (WCAG AA)', () => {
	const css = readFileSync(new URL('../src/styles/variables.css', import.meta.url), 'utf8');
	const darkAt = css.indexOf('@media (prefers-color-scheme: dark)');
	/** @type {{ light: string, dark: string }} */
	const blocks = { light: css.slice(0, darkAt), dark: css.slice(darkAt) };

	/** @param {string} hex */
	function luminance(hex) {
		const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
		const linear = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
	}

	/** @param {string} fg @param {string} bg */
	function contrast(fg, bg) {
		const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
		return (a + 0.05) / (b + 0.05);
	}

	/** @param {Record<string, string>} tokens @param {string} block @param {string} name */
	function value(tokens, block, name) {
		return tokens[`--color-${name}`] ?? new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(block)?.[1];
	}

	const PAIRS = [
		['ink', 'paper'],
		['ink-soft', 'paper'],
		['ink-faint', 'paper'],
		['bud-deep', 'paper']
	];

	/** @type {('light' | 'dark')[]} */
	const MODES = ['light', 'dark'];

	for (const [preset, definition] of Object.entries(PRESETS)) {
		for (const mode of MODES) {
			const tokens = definition[mode] ?? {};
			it(`${preset} (${mode}) keeps meta text readable`, () => {
				for (const [fg, bg] of PAIRS) {
					const f = value(tokens, blocks[mode], fg);
					const b = value(tokens, blocks[mode], bg);
					if (!f || !b) continue;
					expect(contrast(f, b), `${preset} ${mode}: --color-${fg} on --color-${bg}`).toBeGreaterThanOrEqual(4.5);
				}
			});
		}
	}
});

/**
 * The share image is drawn outside the CSS cascade, so it needs a concrete
 * palette. That palette is parsed from `variables.css` (single source of truth)
 * rather than duplicated in TypeScript.
 */
describe('resolved palette for non-CSS consumers', () => {
	it('reads the base sheet and follows var() aliases', () => {
		const palette = resolvePalette('classic', {});
		expect(palette['--color-paper']).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(palette['--border-color']).toBe(palette['--color-outline']);
		expect(palette['--color-outline']).toBe(palette['--color-paper-line']);
	});

	it('applies preset values and per-site overrides', () => {
		expect(resolvePalette('mono', {})['--color-paper']).toBe('#f6f6f3');
		expect(resolvePalette('classic', { '--color-bud': '#123456' })['--color-bud']).toBe('#123456');
	});
});
