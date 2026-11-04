/**
 * The contract between an instance and the engine.
 *
 * An instance owns exactly two JavaScript files — `$site/config` (identity) and
 * `$site/assembly` (what the site is made of) — plus optional page overlays.
 * These interfaces are what those files are checked against, so an instance
 * gets the same type safety as the engine's own demo without importing the
 * engine's implementation. See `docs/INSTANCE.md`.
 */
import type { CommentablePage } from '$lib/content/pages';
import type { ContentTypeDef, HomeSection, Mod } from '$lib/content/schema';

export interface Locale {
	code: string;
	label: string;
	/** Compact label for the language switch (`EN` / `中`). Defaults to the uppercased code. */
	short?: string;
	/** BCP-47 tag for `Intl`. */
	intl?: string;
	/** Overrides the default `YYYY.MM.DD` date format for this locale. */
	dateFormat?: Intl.DateTimeFormatOptions;
	dir?: 'ltr' | 'rtl';
}

export interface Brand {
	claim: string;
	claimSource: string;
	creed: string[];
	ogTagline: string;
	seoTitle: string;
	seoDescription: string;
	feedDescription: string;
	/** `jobTitle` in structured data. */
	role?: string;
}

export interface SiteConfig {
	name: string;
	/** No trailing slash. Drives canonical / hreflang / sitemap / OG / RSS. */
	url: string;
	author: string;
	locales: Locale[];
	defaultLocale: string;
	ogImage?: string;
	logo?: string;
	topics?: string[];
	contact: { email: string; github: string };
	brand: Record<string, Brand>;
}

export interface SiteAssembly {
	contentTypes: Record<string, ContentTypeDef>;
	features: string[];
	home: { sections: HomeSection[] };
	theme: { name: string; tokens: Record<string, string> };
	mods: Mod[];
	privateRoutes: string[];
	content: { defaultVisibility: 'public' | 'private'; timelineOrder: 'published' | 'occurred' };
	commentablePages: CommentablePage[];
}
