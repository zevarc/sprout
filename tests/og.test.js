import { describe, it, expect } from 'vitest';
import { generateOgSvg, wrapTitle } from '$lib/og';
import { resolvePalette } from '$lib/engine/theme';

describe('Open Graph share image', () => {
	it('paints with the resolved theme palette, not stock colours', () => {
		const svg = generateOgSvg('Hello, sprout', 'en');
		const palette = resolvePalette('classic', {});

		expect(svg).toContain(`stop-color="${palette['--color-paper']}"`);
		expect(svg).toContain(`fill="${palette['--color-ink']}"`);
	});

	it('wraps long CJK titles and truncates with an ellipsis', () => {
		const lines = wrapTitle('一'.repeat(120), 20);
		expect(lines.length).toBeLessThanOrEqual(3);
		expect(lines.at(-1)?.endsWith('…')).toBe(true);
	});
});
