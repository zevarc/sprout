import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	resolve: {
		alias: {
			// Unit tests import server/app modules directly; no SvelteKit plugin needed.
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
	test: {
		include: ['tests/**/*.test.{js,ts}'],
		environment: 'node'
	}
});
