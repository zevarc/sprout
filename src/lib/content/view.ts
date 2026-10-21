/**
 * Maps a stored ContentNode into the shape the presentation components expect.
 *
 * Derived fields (read time, excerpt, TOC) are computed here from `bodyMd` so
 * they never go stale. Type-specific attributes arrive as `fields` (from
 * `node_fields`); cross-type concepts (tags, featured, cover) are real columns
 * or relations and are resolved here.
 */

import type { ContentNode, MediaItem, NodeVisibility } from '$lib/content/types';
import { getContentType } from '$lib/content/registry';
import { calcReadTime, extractExcerpt, extractHeadings, type TocItem } from '$lib/reading';
import { getLink } from '$lib/i18n';
import { site } from '$lib/site';
import type { D1Database } from '$lib/server/db';
import { listFeatured, listNodes } from '$lib/server/repositories/nodes';

export interface MediaView {
	id: string;
	/** Relative URL served by our own `/media/<key>` route. */
	url: string;
	alt: string | null;
	kind: string;
	position: number;
}

export interface PostView {
	id: string;
	slug: string;
	type: string;
	lng: string;
	url: string;
	title: string;
	/** The node's summary; the single source of truth for descriptions. */
	description: string;
	date: string;
	/** When the thing happened, if recorded (falls back to `date` in views). */
	occurredAt: string | null;
	authorActorId: string | null;
	visibility: NodeVisibility;
	featured: boolean;
	updated: string;
	tags: string[];
	/** Cover URL resolved from `cover_media_id`, or null. */
	cover: string | null;
	/** Attached media, ordered by `position` (the gallery). */
	media: MediaView[];
	bodyHtml: string;
	readTime: number;
	excerpt: string;
	headings: TocItem[];
	hasAlt: boolean;
	jsonLd: Record<string, unknown>;
	/** Type-specific attributes (from `node_fields`). */
	fields: Record<string, unknown>;
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function mediaView(item: MediaItem): MediaView {
	return {
		id: item.id,
		url: `/media/${item.r2Key}`,
		alt: item.alt,
		kind: item.kind,
		position: item.position
	};
}

export function nodeUrl(node: ContentNode): string {
	const def = getContentType(node.type);
	const routePath = (def?.route ?? `/${node.type}`).replace(/^\//, '');
	return `${getLink(routePath, node.lang)}/${node.slug}`;
}

export function nodeToView(node: ContentNode, hasAlt = false): PostView {
	const fields = node.fields ?? {};
	const date = node.publishedAt ?? node.createdAt;
	const updated = str(fields.updatedAt, node.updatedAt);
	const description = node.summary ?? '';
	const media = (node.media ?? []).map(mediaView);
	const coverItem = node.coverMediaId
		? (node.media ?? []).find((m) => m.id === node.coverMediaId)
		: undefined;
	const url = nodeUrl(node);

	return {
		id: node.id,
		slug: node.slug,
		type: node.type,
		lng: node.lang,
		url,
		title: node.title ?? node.slug,
		description,
		date,
		occurredAt: node.occurredAt,
		authorActorId: node.authorActorId,
		visibility: node.visibility,
		featured: node.featured,
		updated,
		tags: node.tags ?? [],
		cover: coverItem ? `/media/${coverItem.r2Key}` : null,
		media,
		bodyHtml: node.bodyHtml ?? '',
		readTime: calcReadTime(node.bodyMd),
		excerpt: extractExcerpt(node.bodyMd, description),
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
 * Public list views. Defaults to `visibility: 'public'` so a private node can
 * never reach a public page by forgetting a filter — pass `visibility: 'private'`
 * (or use `listNodes` directly) for the owner/member area.
 */
export async function listViews(
	db: D1Database,
	opts: {
		types: string[];
		lang: string;
		tag?: string;
		visibility?: NodeVisibility;
		limit?: number;
	}
): Promise<PostView[]> {
	const nodes = await listNodes(db, {
		types: opts.types,
		lang: opts.lang,
		status: 'published',
		tag: opts.tag,
		visibility: opts.visibility ?? 'public',
		limit: opts.limit ?? 100
	});
	return nodes.map((n) => nodeToView(n));
}

/** Featured views (nodes with `featured = 1`). Public by default. */
export async function listFeaturedViews(
	db: D1Database,
	opts: { types: string[]; lang: string; visibility?: NodeVisibility; limit?: number }
): Promise<PostView[]> {
	const nodes = await listFeatured(db, opts);
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
	github: string | null;
	order: number;
	/** active | maintained | archived — null when not stated. */
	status: string | null;
	/** Route to the project detail page, e.g. `projects/pinyfy`. */
	url: string;
}

export function nodeToProjectView(n: ContentNode): ProjectView {
	const fields = n.fields ?? {};
	return {
		id: n.id,
		slug: n.slug,
		lang: n.lang,
		year: String(fields.year ?? ''),
		title: n.title ?? n.slug,
		description: n.summary ?? '',
		image: typeof fields.image === 'string' ? fields.image : null,
		tags: n.tags ?? [],
		website: typeof fields.website === 'string' ? fields.website : null,
		github: typeof fields.github === 'string' ? fields.github : null,
		order: Number(fields.order ?? 999),
		status: typeof fields.status === 'string' ? fields.status : null,
		url: `${getLink('projects', n.lang)}/${n.slug}`
	};
}

function byProjectOrder(a: ProjectView, b: ProjectView): number {
	return a.order - b.order || a.title.localeCompare(b.title);
}

/** Projects are a content type too — no special storage. Public by default. */
export async function listProjects(
	db: D1Database,
	lang: string,
	limit = 100
): Promise<ProjectView[]> {
	const nodes = await listNodes(db, {
		type: 'project',
		lang,
		status: 'published',
		visibility: 'public',
		limit: 100
	});
	return nodes.map(nodeToProjectView).sort(byProjectOrder).slice(0, limit);
}

/** Related posts by shared tags, then recency. */
export async function findRelatedViews(
	db: D1Database,
	node: ContentNode,
	limit = 3
): Promise<PostView[]> {
	const tags = new Set((node.tags ?? []).map((t) => t.toLowerCase()));
	if (tags.size === 0) return [];

	const candidates = await listNodes(db, {
		type: node.type,
		lang: node.lang,
		status: 'published',
		// Same visibility as the node being read, so a public page never lists
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
