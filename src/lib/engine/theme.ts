/**
 * Theme layer: a token contract, not per-component forks.
 *
 * Components only read CSS custom properties (`var(--color-*)`, `var(--shadow-*)`).
 * A site picks a named preset and may override any token; mods can contribute
 * tokens too (via the assembly). The resolved tokens are injected into `<head>`
 * at SSR so there is no flash and dark mode keeps working.
 */

import { theme as assembledTheme } from '$lib/engine/registry';

export interface ThemeDefinition {
	light: Record<string, string>;
	dark?: Record<string, string>;
}

/** Built-in themes. `classic` is the base palette in `styles/variables.css`. */
export const PRESETS: Record<string, ThemeDefinition> = {
	classic: { light: {} },
	mono: {
		light: {
			'--color-paper': '#f6f6f3',
			'--color-paper-deep': '#ecece7',
			'--color-paper-line': '#d6d6cf',
			'--color-ink': '#1f1f1c',
			'--color-ink-soft': '#55554e',
			'--color-ink-faint': '#86867d',
			'--color-bud': '#4c4c44',
			'--color-bud-deep': '#2e2e28',
			'--color-bud-soft': '#c7c7be',
			'--color-bud-pale': '#e7e7e0',
			'--color-sprout': '#c07a2e',
			'--color-sprout-deep': '#9a5f22',
			'--color-sprout-pale': '#f3e6d2',
			'--grid-line': 'rgba(76, 76, 68, 0.06)',
			'--grad-bud-a': '#8f8f85',
			'--grad-bud-b': '#c9c9c0',
			'--grad-bud-c': '#e0b878',
			'--color-surface-container-low': '#efefea',
			'--color-surface-container-high': '#e1e1da',
			'--color-on-primary': '#ffffff',
			'--color-on-primary-container': '#ffffff',
			'--color-error': '#b3261e',
			'--shadow-soft': '0 2px 10px rgba(31, 31, 28, 0.08)',
			'--shadow-float': '0 4px 16px rgba(31, 31, 28, 0.12)',
			'--shadow-glow': '0 6px 20px rgba(76, 76, 68, 0.2)',
			'--shadow-card': '0 8px 26px rgba(76, 76, 68, 0.14)'
		},
		dark: {
			'--color-paper': '#151513',
			'--color-paper-deep': '#1e1e1b',
			'--color-paper-line': '#34342f',
			'--color-ink': '#ececE6',
			'--color-ink-soft': '#a6a69c',
			'--color-ink-faint': '#76766d',
			'--color-bud': '#c2c2b8',
			'--color-bud-deep': '#deded4',
			'--color-bud-soft': '#3a3a34',
			'--color-bud-pale': '#2a2a26',
			'--color-sprout': '#d7a45c',
			'--color-sprout-deep': '#b8843c',
			'--color-sprout-pale': '#332a1a',
			'--grid-line': 'rgba(236, 236, 230, 0.05)',
			'--grad-bud-a': '#c2c2b8',
			'--grad-bud-b': '#6a6a60',
			'--grad-bud-c': '#c9924c',
			'--color-surface-container-low': '#191916',
			'--color-surface-container-high': '#262620',
			'--color-on-primary': '#101010',
			'--color-on-primary-container': '#f0f0ea',
			'--color-error': '#f2b8b5',
			'--shadow-soft': '0 2px 10px rgba(0, 0, 0, 0.4)',
			'--shadow-float': '0 4px 16px rgba(0, 0, 0, 0.5)',
			'--shadow-glow': '0 6px 22px rgba(194, 194, 184, 0.16)',
			'--shadow-card': '0 8px 26px rgba(0, 0, 0, 0.45)'
		}
	},
	warm: {
		light: {
			'--color-paper': '#f6f1e7',
			'--color-paper-deep': '#efe7d9',
			'--color-paper-line': '#e0d4c0',
			'--color-ink': '#33291f',
			'--color-ink-soft': '#6b5c4a',
			'--color-ink-faint': '#9a8a74',
			'--color-bud': '#9a6b3f',
			'--color-bud-deep': '#7a512c',
			'--color-bud-soft': '#dcc4a6',
			'--color-bud-pale': '#f0e3d0',
			'--color-sprout': '#b5893f',
			'--color-sprout-deep': '#8f6a2c',
			'--color-sprout-pale': '#f3e7cf',
			'--grid-line': 'rgba(154, 107, 63, 0.07)',
			'--grad-bud-a': '#b98a5a',
			'--grad-bud-b': '#e0c6a4',
			'--grad-bud-c': '#d9b06a',
			'--color-surface-container-low': '#f2eadd',
			'--color-surface-container-high': '#e8ddcc',
			'--color-on-primary': '#fff8ee',
			'--color-on-primary-container': '#3a2a18',
			'--color-error': '#b3261e',
			'--shadow-soft': '0 2px 10px rgba(51, 41, 31, 0.08)',
			'--shadow-float': '0 4px 16px rgba(51, 41, 31, 0.12)',
			'--shadow-glow': '0 6px 20px rgba(154, 107, 63, 0.2)',
			'--shadow-card': '0 8px 26px rgba(154, 107, 63, 0.14)'
		},
		dark: {
			'--color-paper': '#1b1611',
			'--color-paper-deep': '#241d16',
			'--color-paper-line': '#3a2f24',
			'--color-ink': '#ece3d6',
			'--color-ink-soft': '#b3a48f',
			'--color-ink-faint': '#857662',
			'--color-bud': '#d0a878',
			'--color-bud-deep': '#e3c193',
			'--color-bud-soft': '#43362a',
			'--color-bud-pale': '#2e261d',
			'--color-sprout': '#d9b06a',
			'--color-sprout-deep': '#c0913f',
			'--color-sprout-pale': '#332a1a',
			'--grid-line': 'rgba(208, 168, 120, 0.06)',
			'--grad-bud-a': '#d0a878',
			'--grad-bud-b': '#7a624a',
			'--grad-bud-c': '#c9924c',
			'--color-surface-container-low': '#1f1913',
			'--color-surface-container-high': '#2b231b',
			'--color-on-primary': '#1a1108',
			'--color-on-primary-container': '#f3e7d4',
			'--color-error': '#f2b8b5',
			'--shadow-soft': '0 2px 10px rgba(0, 0, 0, 0.4)',
			'--shadow-float': '0 4px 16px rgba(0, 0, 0, 0.5)',
			'--shadow-glow': '0 6px 22px rgba(208, 168, 120, 0.16)',
			'--shadow-card': '0 8px 26px rgba(0, 0, 0, 0.45)'
		}
	}
};

export interface ResolvedTheme {
	name: string;
	light: Record<string, string>;
	dark?: Record<string, string>;
}

/** Resolve a preset + overrides. Overrides win in both light and dark. */
export function resolveTheme(
	name: string = assembledTheme?.name ?? 'classic',
	overrides: Record<string, string> = assembledTheme?.tokens ?? {}
): ResolvedTheme {
	const preset = PRESETS[name] ?? PRESETS.classic;
	return {
		name,
		light: { ...preset.light, ...overrides },
		dark: preset.dark ? { ...preset.dark, ...overrides } : undefined
	};
}

function declarations(tokens: Record<string, string>): string {
	return Object.entries(tokens)
		.map(([key, value]) => `${key}:${value};`)
		.join('');
}

/**
 * CSS for the resolved theme. Returns `''` for the classic theme with no
 * overrides — the base palette in `variables.css` already applies.
 */
export function themeCss(
	name?: string,
	overrides?: Record<string, string>
): string {
	const { light, dark } = resolveTheme(name, overrides);
	const hasLight = Object.keys(light).length > 0;
	if (!hasLight && !dark) return '';

	let css = `:root{${declarations(light)}}`;
	if (dark) {
		css += `@media (prefers-color-scheme: dark){:root{${declarations(dark)}}}`;
	}
	return css;
}
