/**
 * Maps a stored asset into the shape the presentation components expect.
 *
 * Derived fields (read time, excerpt, TOC, cover URL) are computed here from the
 * source, so they never go stale. Type-specific attributes arrive as `fields`
 * (real columns on the kind's table); tags and media are relations.
 */

import type { ContentNode, Visibility } from '$lib/content/types';
import { getContentType } from '$lib/content/registry';
import { calcReadTime, extractExcerpt, extractHeadings, type TocItem } from '$lib/reading';
import { getLink } from '$lib/i18n';
import { site } from '$lib/site';
import type { D1Database } from '$lib/server/db';
import { listAssets, type FieldOrder } from '$lib/server/repositories/assets';

export interface MediaView {
	id: string;
	/** Relative URL served by our own `/media/<key>` route. */
	url: string;
	alt: string | null;
	kind: string;
	position: number;
	role: 'body' | 'cover';
}

export interface PostView {
	id: string;
	slug: string;
	type: string;
	lng: string;
	url: string;
	title: string;
	/** The asset's summary; the single source of truth for descriptions. */
	description: string;
	date: string;
	/** When the thing happened, if recorded (falls back to `date` in views). */
	occurredAt: string | null;
	authorId: string;
	visibility: Visibility;
	updated: string;
	tags: string[];
	/** Cover URL resolved from the cover binding, or null. */
	cover: string | null;
	/** Attached media, ordered by `position` (the gallery). */
	media: MediaView[];
	bodyHtml: string;
	readTime: number;
	excerpt: string;
	headings: TocItem[];
	/** True when the asset has translations (a group with siblings). */
	hasAlt: boolean;
	jsonLd: Record<string, unknown>;
	/** The kind's declared attributes (real columns on the kind table). */
	fields: Record<string, unknown>;
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function mediaView(item: ContentNode['media'][number]): MediaView {
	return {
		id: item.id,
		url: `/media/${item.r2Key}`,
		alt: item.alt,
		kind: item.kind,
		position: item.position,
		role: item.role
	};
}

export function nodeUrl(node: ContentNode): string {
	const def = getContentType(node.type);
	const routePath = (def?.route ?? `/${node.type}`).replace(/^\//, '');
	return `${getLink(routePath, node.lang)}/${node.slug}`;
}

export interface TranslationLink {
	lang: string;
	url: string;
}

/**
 * Alternate-language links for an asset, built from its group members:
 * one entry per language, ordered by `site.locales`. Only published, public
 * assets qualify — a draft or private translation must not be advertised.
 * Each URL comes from that member's own slug, so translations need not share one.
 */
export function translationLinks(nodes: ContentNode[]): TranslationLink[] {
	const byLang = new Map<string, TranslationLink>();
	for (const node of nodes) {
		if (node.status !== 'published' || node.visibility !== 'public') continue;
		if (byLang.has(node.lang)) continue;
		byLang.set(node.lang, { lang: node.lang, url: nodeUrl(node) });
	}
	return site.locales
		.map((locale) => byLang.get(locale.code))
		.filter((link): link is TranslationLink => Boolean(link));
}

export function nodeToView(node: ContentNode, hasAlt = false): PostView {
	const fields = node.fields ?? {};
	const date = node.publishedAt ?? node.createdAt;
	const updated = str(fields.updatedAt, node.updatedAt);
	const media = (node.media ?? []).map(mediaView);
	const coverItem = node.coverMediaId
		? (node.media ?? []).find((m) => m.id === node.coverMediaId)
		: undefined;

	return {
		id: node.id,
		slug: node.slug,
		type: node.type,
		lng: node.lang,
		url: nodeUrl(node),
		title: node.title ?? node.slug,
		description: node.summary ?? '',
		date,
		occurredAt: node.occurredAt,
		authorId: node.authorId,
		visibility: node.visibility,
		updated,
		tags: node.tags ?? [],
		cover: coverItem ? `/media/${coverItem.r2Key}` : null,
		media,
		bodyHtml: node.bodyHtml ?? '',
		readTime: calcReadTime(node.bodyMd),
		excerpt: extractExcerpt(node.bodyMd, node.summary ?? ''),
		headings: extractHeadings(node.bodyMd),
		hasAlt,
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'TechArticle',
			headline: node.title ?? node.slug,
			datePublished: node.publishedAt ?? node.createdAt,
			dateModified: updated,
			author: { '@type': 'Person', name: site.author }
		},
		fields
	};
}

/**
 * Public list views. Defaults to `visibility: 'public'` so a private asset can
 * never reach a public page by forgetting a filter — pass `visibility: 'private'`
 * (or use `listAssets` directly) for the owner area.
 */
export async function listViews(
	db: D1Database,
	opts: {
		types: string[];
		lang: string;
		tag?: string;
		visibility?: Visibility;
		limit?: number;
		orderByField?: FieldOrder;
		orderBy?: 'published' | 'occurred';
	}
): Promise<PostView[]> {
	const nodes = await listAssets(db, {
		types: opts.types,
		lang: opts.lang,
		status: 'published',
		tag: opts.tag,
		visibility: opts.visibility ?? 'public',
		orderByField: opts.orderByField,
		orderBy: opts.orderBy,
		limit: opts.limit ?? 100
	});
	return nodes.map((n) => nodeToView(n));
}

export interface ProjectView {
	id: string;
	slug: string;
	lang: string;
	year: string;
	title: string;
	description: string;
	image: string | null;
	tags: string[];
	website: string | null;
	repoUrl: string | null;
	orderIndex: number;
	/** active | maintained | archived — null when not stated. */
	stage: string | null;
	/** Route to the project detail page, e.g. `projects/pinyfy`. */
	url: string;
}

export function nodeToProjectView(n: ContentNode): ProjectView {
	return {
		id: n.id,
		slug: n.slug,
		lang: n.lang,
		year: String(n.fields?.year ?? ''),
		title: n.title ?? n.slug,
		description: n.summary ?? '',
		image: n.coverMediaId
			? `/media/${n.media.find((m) => m.id === n.coverMediaId)?.r2Key ?? ''}`
			: null,
		tags: n.tags ?? [],
		website: typeof n.fields?.website === 'string' ? n.fields.website : null,
		repoUrl: typeof n.fields?.repo_url === 'string' ? n.fields.repo_url : null,
		orderIndex: Number(n.fields?.order_index ?? 999),
		stage: typeof n.fields?.stage === 'string' ? n.fields.stage : null,
		url: `${getLink('projects', n.lang)}/${n.slug}`
	};
}

function byProjectOrder(a: ProjectView, b: ProjectView): number {
	return a.orderIndex - b.orderIndex || a.title.localeCompare(b.title);
}

/** Projects are a content kind too — no special storage. Public by default. */
export async function listProjects(
	db: D1Database,
	lang: string,
	limit = 100
): Promise<ProjectView[]> {
	const nodes = await listAssets(db, {
		type: 'project',
		lang,
		status: 'published',
		visibility: 'public',
		limit: 100
	});
	return nodes.map(nodeToProjectView).sort(byProjectOrder).slice(0, limit);
}

/** Related assets by shared tags, then recency. */
export async function findRelatedViews(
	db: D1Database,
	node: ContentNode,
	limit = 3
): Promise<PostView[]> {
	const tags = new Set((node.tags ?? []).map((t) => t.toLowerCase()));
	if (tags.size === 0) return [];

	const candidates = await listAssets(db, {
		type: node.type,
		lang: node.lang,
		status: 'published',
		// Same visibility as the asset being read, so a public page never lists
		// a private sibling as "related".
		visibility: node.visibility,
		limit: 100
	});
	return candidates
		.filter((n) => n.id !== node.id)
		.map((n) => {
			const nTags = n.tags ?? [];
			const score = nTags.filter((t) => tags.has(t.toLowerCase())).length;
			return { n, score };
		})
		.filter((x) => x.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				new Date(b.n.publishedAt ?? b.n.createdAt).getTime() -
					new Date(a.n.publishedAt ?? a.n.createdAt).getTime()
		)
		.slice(0, limit)
		.map((x) => nodeToView(x.n));
}
