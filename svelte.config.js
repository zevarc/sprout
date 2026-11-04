import adapter from '@sveltejs/adapter-cloudflare';
import path from 'node:path';

/**
 * `$site` is the seam between the engine and a site: it points at the files an
 * instance owns (identity, assembly, page overlays). In this repo the engine
 * *is* the demo instance, so it points at `src/site/`; a site that consumes
 * this repo as an engine package points `$site` at its own `src/site/` and
 * overrides `kit.files.*` to load routes/lib from here. See docs/INSTANCE.md.
 */

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte'],
	kit: {
		adapter: adapter(),
		alias: {
			$site: path.resolve('src/site')
		}
	}
};

export default config;
