/**
 * The assembled registry: base `sprout.config.js` plus every contributed mod.
 * This is the single source the engine reads for types, features, home sections
 * and theme tokens.
 */

import {
	contentTypes as baseContentTypes,
	features as baseFeatures,
	home as baseHome,
	theme as baseTheme,
	mods as declaredMods,
	privateRoutes as basePrivateRoutes,
	content as baseContent,
	commentablePages as baseCommentablePages
} from '$lib/sprout';
import { mergeAssembly } from '$lib/engine/assembly';
import type { ContentTypeDef, Mod } from '$lib/content/schema';

const assembly = mergeAssembly(
	{
		contentTypes: baseContentTypes as unknown as Record<string, ContentTypeDef>,
		features: baseFeatures,
		home: baseHome,
		theme: baseTheme
	},
	declaredMods as unknown as Mod[]
);

export const contentTypes = assembly.contentTypes;
export const features = assembly.features;
export const homeSections = assembly.home.sections;
export const theme = assembly.theme;
export const mods = assembly.mods;
/** Dictionary fragments contributed by mods, merged by `getDictionary`. */
export const i18nFragments = assembly.i18n;

/** Non-type paths that require an owner/member session. */
export const privateRoutes = basePrivateRoutes;
/** Content defaults (visibility, timeline ordering). */
export const content = baseContent;

/** Static pages that accept comments (see `src/lib/content/pages.ts`). */
export const commentablePages: import('$lib/content/pages').CommentablePage[] =
	baseCommentablePages ?? [];

export default assembly;
