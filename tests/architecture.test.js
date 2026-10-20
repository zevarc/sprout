import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTES = fileURLToPath(new URL('../src/routes', import.meta.url));
const COMPONENTS = fileURLToPath(new URL('../src/lib/components', import.meta.url));

/** @param {string} dir @returns {string[]} */
function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (/\.(ts|js|svelte)$/.test(name)) out.push(p);
	}
	return out;
}

// Data-accuracy is structural: routes must go through the domain layer
// (`lib/server/**`, `lib/content/view`), never issue SQL themselves.
const FORBIDDEN = [
	{ label: 'db.prepare(...)', re: /\.prepare\s*\(/ },
	{ label: 'query(...)', re: /\bquery\s*(<[^>]*>)?\s*\(/ },
	{ label: 'run(...)', re: /\brun\s*\(/ },
	{ label: 'first(...)', re: /\bfirst\s*(<[^>]*>)?\s*\(/ }
];

describe('architecture guard', () => {
	it('routes never talk to the database directly', () => {
		/** @type {string[]} */
		const offenders = [];
		for (const file of walk(ROUTES)) {
			const text = readFileSync(file, 'utf8');
			for (const { label, re } of FORBIDDEN) {
				if (re.test(text)) offenders.push(`${file.replace(ROUTES, 'src/routes')}: ${label}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('components style only through theme tokens', () => {
		// A theme is a token set, not a component fork: literals in <style> would
		// leak past the theme layer.
		const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
		/** @type {string[]} */
		const offenders = [];
		for (const file of walk(COMPONENTS)) {
			if (!file.endsWith('.svelte')) continue;
			const text = readFileSync(file, 'utf8');
			const style = text.split('<style>')[1] ?? '';
			if (COLOR_LITERAL.test(style)) {
				offenders.push(file.replace(COMPONENTS, 'src/lib/components'));
			}
		}
		expect(offenders).toEqual([]);
	});
});
