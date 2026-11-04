/**
 * Single import point for the site assembly.
 * App code should use `import { contentTypes, features, home, theme, mods } from '$lib/sprout'`.
 *
 * Like `$lib/site`, the backing file is instance-owned (`$site/assembly`).
 */
export {
	contentTypes,
	features,
	home,
	theme,
	mods,
	privateRoutes,
	content,
	commentablePages
} from '$site/assembly';
export { default as sprout } from '$site/assembly';
