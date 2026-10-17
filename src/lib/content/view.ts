/**
 * Maps a stored ContentNode into the shape the presentation components expect.
 * Derived fields (read time, excerpt, TOC) are computed here from `bodyMd`
 * so they never go stale.
 */

import type { ContentNode } from '$lib/content/types';
import { getContentType } from '$lib/content/registry';
import { calcReadTime, extractExcerpt, extractHeadings, type TocItem } from '$lib/reading';
import { getLink } from '$lib/i18n';
import { site } from '$lib/site';
import type { D1Database } from '$lib/server/db';
import { listNodes } from '$lib/server/repositories/nodes';

export interface PostView {
	id: string;
	slug: string;
	type: string;
	lng: string;
	url: string;
	title: string;
	description: string;
	date: string;
	updated: string;
	tags: string[];
	cover: string | null;
	bodyHtml: string;
	readTime: number;
	excerpt: string;
	headings: TocItem[];
	hasAlt: boolean;
	jsonLd: Record<string, unknown>;
	extra: Record<string, unknown>;
}

function str(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

export function nodeUrl(node: ContentNode): string {
	const def = getContentType(node.type);
	const routePath = (def?.route ?? `/${node.type}`).replace(/^\//, '');
	return `${getLink(routePath, node.lang)}/${node.slug}`;
}

export function nodeToView(node: ContentNode, hasAlt = false): PostView {
	const extra = node.extra ?? {};
	const tags = Array.isArray(extra.tags) ? (extra.tags as string[]) : [];
	const date = node.publishedAt ?? node.createdAt;
	const updated = str(extra.updatedAt, node.updatedAt);
	const description = str(extra.description, node.summary ?? '');
	const cover = typeof extra.cover === 'string' ? extra.cover : null;
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
		updated,
		tags,
		cover,
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
		extra
	};
}

export async function listViews(
	db: D1Database,
	opts: { types: string[]; lang: string; limit?: number }
): Promise<PostView[]> {
	const nodes = await listNodes(db, {
		types: opts.types,
		lang: opts.lang,
		status: 'published',
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
	github: string | null;
	order: number;
}

/** Projects are a content type too — no special storage. */
export async function listProjects(db: D1Database, lang: string): Promise<ProjectView[]> {
	const nodes = await listNodes(db, {
		type: 'project',
		lang,
		status: 'published',
		limit: 100
	});
	return nodes
		.map((n) => ({
			id: n.id,
			slug: n.slug,
			lang: n.lang,
			year: String(n.extra?.year ?? ''),
			title: n.title ?? n.slug,
			description: String(n.extra?.description ?? n.summary ?? ''),
			image: typeof n.extra?.image === 'string' ? n.extra.image : null,
			tags: Array.isArray(n.extra?.tags) ? (n.extra.tags as string[]) : [],
			website: typeof n.extra?.website === 'string' ? n.extra.website : null,
			github: typeof n.extra?.github === 'string' ? n.extra.github : null,
			order: Number(n.extra?.order ?? 999)
		}))
		.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** Related posts by shared tags, then recency. */
export async function findRelatedViews(
	db: D1Database,
	node: ContentNode,
	limit = 3
): Promise<PostView[]> {
	const tags = new Set(
		(Array.isArray(node.extra?.tags) ? (node.extra!.tags as string[]) : []).map((t) =>
			t.toLowerCase()
		)
	);
	const candidates = await listNodes(db, {
		type: node.type,
		lang: node.lang,
		status: 'published',
		limit: 100
	});
	return candidates
		.filter((n) => n.id !== node.id)
		.map((n) => {
			const nTags = Array.isArray(n.extra?.tags) ? (n.extra!.tags as string[]) : [];
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
