/**
 * `comments` (docs/DATA-MODEL.md §4.7).
 *
 * One status column, not a status log: no read has to resolve "the newest row",
 * and the trusted-commenter check cannot drift from the moderation state.
 */

import type { D1Database } from '$lib/server/db';
import { first, query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';
import type { Comment, CommentStatus } from '$lib/content/types';

interface CommentRow {
	id: string;
	asset_id: string;
	parent_id: string | null;
	author_id: string;
	body_md: string;
	status: string;
	moderated_at: string | null;
	moderated_by: string | null;
	payload: string | null;
	created_at: string;
}

function toComment(row: CommentRow): Comment {
	let payload: Record<string, unknown> | null = null;
	if (row.payload) {
		try {
			payload = JSON.parse(row.payload);
		} catch {
			payload = null;
		}
	}
	return {
		id: row.id,
		assetId: row.asset_id,
		parentId: row.parent_id,
		authorId: row.author_id,
		bodyMd: row.body_md,
		status: row.status as CommentStatus,
		moderatedAt: row.moderated_at,
		moderatedBy: row.moderated_by,
		payload,
		createdAt: row.created_at
	};
}

export interface NewCommentInput {
	assetId: string;
	parentId?: string | null;
	authorId: string;
	bodyMd: string;
	payload?: Record<string, unknown> | null;
}

export async function addComment(db: D1Database, input: NewCommentInput): Promise<Comment> {
	const id = ulid();
	const now = new Date().toISOString();
	await run(
		db,
		`INSERT INTO comments (id, asset_id, parent_id, author_id, body_md, status, payload, created_at)
		 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
		[
			id,
			input.assetId,
			input.parentId ?? null,
			input.authorId,
			input.bodyMd,
			input.payload ? JSON.stringify(input.payload) : null,
			now
		]
	);
	return {
		id,
		assetId: input.assetId,
		parentId: input.parentId ?? null,
		authorId: input.authorId,
		bodyMd: input.bodyMd,
		status: 'pending',
		moderatedAt: null,
		moderatedBy: null,
		payload: input.payload ?? null,
		createdAt: now
	};
}

/** Sets the moderation state. This is an UPDATE by design (one status column). */
export async function setCommentStatus(
	db: D1Database,
	id: string,
	status: CommentStatus,
	by: string | null
): Promise<void> {
	await run(
		db,
		'UPDATE comments SET status = ?, moderated_at = ?, moderated_by = ? WHERE id = ?',
		[status, new Date().toISOString(), by, id]
	);
}

export interface ListCommentsOptions {
	assetId?: string;
	/** Restrict to one status. Omit with `includeAll` for everything. */
	status?: CommentStatus;
	/** Owner view: no status filter. */
	includeAll?: boolean;
	limit?: number;
}

/** Comments, newest last (so a thread reads top to bottom). */
export async function listComments(
	db: D1Database,
	opts: ListCommentsOptions = {}
): Promise<Comment[]> {
	const where: string[] = [];
	const params: unknown[] = [];
	if (opts.assetId) {
		where.push('asset_id = ?');
		params.push(opts.assetId);
	}
	if (!opts.includeAll) {
		where.push('status = ?');
		params.push(opts.status ?? 'approved');
	}
	params.push(opts.limit ?? 200);

	const rows = await query<CommentRow>(
		db,
		`SELECT * FROM comments
		  ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		  ORDER BY created_at ASC
		  LIMIT ?`,
		params
	);
	return rows.map(toComment);
}

/** True when this person already has an approved comment (trusted to auto-publish). */
export async function hasApprovedComment(db: D1Database, authorId: string): Promise<boolean> {
	const row = await first<{ n: number }>(
		db,
		"SELECT COUNT(*) AS n FROM comments WHERE author_id = ? AND status = 'approved'",
		[authorId]
	);
	return Number(row?.n ?? 0) > 0;
}

/** Counts comments by a person since an ISO timestamp — the rate-limit window. */
export async function countCommentsSince(
	db: D1Database,
	filter: { authorId: string; since: string }
): Promise<number> {
	const row = await first<{ n: number }>(
		db,
		'SELECT COUNT(*) AS n FROM comments WHERE author_id = ? AND created_at >= ?',
		[filter.authorId, filter.since]
	);
	return Number(row?.n ?? 0);
}

/** Every comment for the export (deterministic order). */
export async function exportCommentRows(db: D1Database): Promise<Record<string, unknown>[]> {
	const rows = await query<Record<string, unknown>>(
		db,
		`SELECT id, asset_id, parent_id, author_id, body_md, status, moderated_at,
		        moderated_by, payload, created_at
		   FROM comments ORDER BY id`
	);
	return rows.map((row) => ({
		...row,
		payload: row.payload ? JSON.parse(String(row.payload)) : null
	}));
}
