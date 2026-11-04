import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			// Unit tests import server/app modules directly; no SvelteKit plugin needed.
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
			// Instance-owned files (identity, assembly, page overlays).
			$site: fileURLToPath(new URL('./src/site', import.meta.url))
		}
	},
	test: {
		include: ['tests/**/*.test.{js,ts}'],
		environment: 'node',
		// The theme layer reads `variables.css?raw` (the palette's single source
		// of truth); without CSS processing in tests that import resolves empty.
		css: true
	}
});
