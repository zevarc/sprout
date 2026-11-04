/**
 * Which *instance* do the scripts act on?
 *
 * The scripts live in the engine, but identity (`site`) and assembly
 * (`contentTypes` / `features` / …) belong to the site that runs them. So they
 * are resolved at runtime from the working directory:
 *
 *   SITE_DIR=/path/to/site pnpm …   # explicit
 *   pnpm …                          # default: the current directory
 *
 * Layout expected: `<site>/src/site/config.js`, `<site>/src/site/assembly.js`
 * (the engine repo itself follows the same layout, so `pnpm content:export`
 * works here with no env var).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Absolute path of the instance the process is working on. */
export const siteDir = path.resolve(process.env.SITE_DIR ?? process.cwd());

/** @param {string} name a file under `<site>/src/site/` */
function siteModule(name) {
	const file = path.join(siteDir, 'src', 'site', name);
	return import(pathToFileURL(file).href);
}

/** The instance's `{ site }` from `src/site/config.js`. */
export async function loadSite() {
	const mod = await siteModule('config.js');
	return mod.site ?? mod.default;
}

/** The instance's assembly exports from `src/site/assembly.js`. */
export async function loadAssembly() {
	const mod = await siteModule('assembly.js');
	return {
		contentTypes: mod.contentTypes ?? {},
		features: mod.features ?? [],
		home: mod.home,
		theme: mod.theme,
		mods: mod.mods ?? [],
		privateRoutes: mod.privateRoutes ?? [],
		content: mod.content,
		commentablePages: mod.commentablePages ?? []
	};
}
