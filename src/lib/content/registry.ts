/**
 * Content type registry — the single place that declares a content kind.
 * Adding a new type (e.g. `link`, `photo`, `quote`) means adding one entry
 * here plus its content; no schema migration, no routing rewrite.
 */

export interface FieldDef {
	key: string;
	label: { en: string; zh: string };
	type: 'text' | 'textarea' | 'markdown' | 'tags' | 'url' | 'number' | 'date';
	required?: boolean;
}

export interface ContentTypeDef {
	type: string;
	/** Base route for the list page, e.g. `/posts`. */
	route: string;
	/** Whether the type exists in both `en` and `zh`. */
	i18n: boolean;
	/** Whether items are included in the RSS/Atom feed. */
	feed: boolean;
	/** Whether the detail page renders a comment section. */
	comments: boolean;
	/** Type-specific fields, persisted under `nodes.extra`. */
	fields: FieldDef[];
}

export const contentTypes: Record<string, ContentTypeDef> = {
	post: {
		type: 'post',
		route: '/posts',
		i18n: true,
		feed: true,
		comments: true,
		fields: [
			{ key: 'description', label: { en: 'Description', zh: '摘要' }, type: 'textarea' },
			{ key: 'cover', label: { en: 'Cover', zh: '封面' }, type: 'url' },
			{ key: 'tags', label: { en: 'Tags', zh: '标签' }, type: 'tags' }
		]
	},
	note: {
		type: 'note',
		route: '/posts/notes',
		i18n: true,
		feed: true,
		comments: true,
		fields: [
			{ key: 'description', label: { en: 'Description', zh: '摘要' }, type: 'textarea' },
			{ key: 'tags', label: { en: 'Tags', zh: '标签' }, type: 'tags' }
		]
	},
	moment: {
		type: 'moment',
		route: '/moments',
		i18n: false,
		feed: true,
		comments: true,
		fields: [{ key: 'tags', label: { en: 'Tags', zh: '标签' }, type: 'tags' }]
	},
	project: {
		type: 'project',
		route: '/projects',
		i18n: true,
		feed: false,
		comments: false,
		fields: [
			{ key: 'year', label: { en: 'Year', zh: '年份' }, type: 'text' },
			{ key: 'description', label: { en: 'Description', zh: '描述' }, type: 'textarea', required: true },
			{ key: 'image', label: { en: 'Image', zh: '配图' }, type: 'url' },
			{ key: 'website', label: { en: 'Website', zh: '网站' }, type: 'url' },
			{ key: 'github', label: { en: 'GitHub', zh: 'GitHub' }, type: 'url' },
			{ key: 'tags', label: { en: 'Tags', zh: '标签' }, type: 'tags' }
		]
	}
};

export function getContentType(type: string): ContentTypeDef | undefined {
	return contentTypes[type];
}

export function listTypes(): ContentTypeDef[] {
	return Object.values(contentTypes);
}

/** Types feeding RSS/Atom, in registry order. */
export function feedTypes(): ContentTypeDef[] {
	return listTypes().filter((t) => t.feed);
}
