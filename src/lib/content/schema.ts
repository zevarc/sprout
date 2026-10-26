/**
 * Shared, dependency-free schema types for the site assembly.
 *
 * Kept separate from `lib/content/registry.ts` so the pure merge (`engine/assembly`)
 * and the helpers can both import them without a cycle.
 */

export type Label = Record<string, string | undefined>;

export interface FieldOption {
	value: string;
	label: Label;
}

export interface FieldDef {
	key: string;
	label: Label;
	type:
		| 'text'
		| 'textarea'
		| 'markdown'
		| 'tags'
		| 'url'
		| 'number'
		| 'date'
		| 'boolean'
		| 'select';
	required?: boolean;
	options?: FieldOption[];
}

export interface ContentTypeDef {
	type: string;
	/** Base route for the list page, e.g. `/posts`. */
	route: string;
	label: Label;
	/** Whether the type has a public route. Default false (owner/member only). */
	public?: boolean;
	feed?: boolean;
	comments?: boolean;
	/** Built-in list renderer key. Default `list`. */
	listRenderer?: 'list' | 'cards' | 'feed';
	/** Built-in detail renderer key. Default `article`. */
	detailRenderer?: 'article' | 'compact';
	/**
	 * schema.org type for structured data (`BlogPosting`, `SocialMediaPosting`,
	 * `SoftwareSourceCode`, …). Defaults per kind in `content/view.ts`.
	 */
	schemaType?: string;
	fields: FieldDef[];
}

export interface HomeSection {
	/** Content types shown in this section. */
	types: string[];
	layout: 'list' | 'cards';
	/** i18n key for the heading. */
	title: string;
	/** i18n key for the "all …" link. */
	more: string;
	/** Path (without locale) the "all" link points at. */
	morePath: string;
	limit: number;
	/** For `cards`: which declared fields to surface (e.g. project links). */
	fields?: string[];
	/**
	 * Optional ordering for this section. `field` sorts by a declared field —
	 * typically a curated `order` — and falls back to publish time when absent.
	 */
	sort?: { field: string; numeric?: boolean; direction?: 'asc' | 'desc' };
}

/** A contribution: data a site or package adds to the assembly. */
export interface Mod {
	id: string;
	contentTypes?: Record<string, ContentTypeDef>;
	features?: string[];
	home?: { sections?: HomeSection[] };
	theme?: { tokens?: Record<string, string> };
	i18n?: Record<string, Record<string, unknown>>;
}

