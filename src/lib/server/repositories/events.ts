import type { ContentEvent, EventKind, EventModeration, NewEvent } from '$lib/content/types';
import type { D1Database } from '$lib/server/db';
import { query, run } from '$lib/server/db';
import { ulid } from '$lib/server/id';

interface EventRow {
	id: string;
	kind: string;
	target_type: string | null;
	target_id: string | null;
	actor_id: string | null;
	parent_id: string | null;
	body_md: string | null;
	payload: string | null;
	created_at: string;
	status?: string | null;
}

function toEvent(row: EventRow): ContentEvent {
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
		kind: row.kind as EventKind,
		targetType: row.target_type,
		targetId: row.target_id,
		actorId: row.actor_id,
		parentId: row.parent_id,
		bodyMd: row.body_md,
		payload,
		createdAt: row.created_at,
		status: (row.status as EventModeration) ?? undefined
	};
}

const LATEST_STATUS = `(
	SELECT s.status FROM event_status s
	WHERE s.event_id = e.id
	ORDER BY s.at DESC, s.rowid DESC
	LIMIT 1
) AS status`;

export async function addEvent(db: D1Database, input: NewEvent): Promise<ContentEvent> {
	const id = input.id ?? ulid();
	const now = new Date().toISOString();
	await run(
		db,
		`INSERT INTO events
			(id, kind, target_type, target_id, actor_id, parent_id, body_md, payload, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			input.kind,
			input.targetType ?? null,
			input.targetId ?? null,
			input.actorId ?? null,
			input.parentId ?? null,
			input.bodyMd ?? null,
			input.payload ? JSON.stringify(input.payload) : null,
			now
		]
	);
	return {
		id,
		kind: input.kind,
		targetType: input.targetType ?? null,
		targetId: input.targetId ?? null,
		actorId: input.actorId ?? null,
		parentId: input.parentId ?? null,
		bodyMd: input.bodyMd ?? null,
		payload: input.payload ?? null,
		createdAt: now
	};
}

/** Appends a moderation status. Never mutates prior rows. */
export async function setEventStatus(
	db: D1Database,
	eventId: string,
	status: EventModeration,
	by: string | null
): Promise<void> {
	await run(
		db,
		'INSERT INTO event_status (event_id, status, at, by) VALUES (?, ?, ?, ?)',
		[eventId, status, new Date().toISOString(), by]
	);
}

export interface ListEventsOptions {
	kind?: EventKind;
	targetType?: string;
	targetId?: string;
	actorId?: string;
	includeUnapproved?: boolean;
	limit?: number;
}

export async function listEvents(
	db: D1Database,
	opts: ListEventsOptions = {}
): Promise<ContentEvent[]> {
	const where: string[] = [];
	const params: unknown[] = [];
	if (opts.kind) {
		where.push('e.kind = ?');
		params.push(opts.kind);
	}
	if (opts.targetType) {
		where.push('e.target_type = ?');
		params.push(opts.targetType);
	}
	if (opts.targetId) {
		where.push('e.target_id = ?');
		params.push(opts.targetId);
	}
	if (opts.actorId) {
		where.push('e.actor_id = ?');
		params.push(opts.actorId);
	}
	params.push(opts.limit ?? 200);

	const rows = await query<EventRow>(
		db,
		`SELECT e.*, ${LATEST_STATUS}
		 FROM events e
		 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		 ORDER BY e.created_at ASC
		 LIMIT ?`,
		params
	);

	const events = rows.map(toEvent);
	if (opts.includeUnapproved) return events;
	return events.filter((e) => (e.status ?? 'approved') === 'approved');
}

/** True when the actor already has an approved comment (trusted to auto-publish). */
export async function hasApprovedComment(db: D1Database, actorId: string): Promise<boolean> {
	const rows = await query<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM events e
		 JOIN event_status s ON s.event_id = e.id
		 WHERE e.kind = 'comment' AND e.actor_id = ? AND s.status = 'approved'`,
		[actorId]
	);
	return (rows[0]?.n ?? 0) > 0;
}

/** Counts events by an actor/kind since an ISO timestamp — used for rate limiting. */
export async function countEventsSince(
	db: D1Database,
	filter: { actorId?: string; kind?: EventKind; since: string }
): Promise<number> {
	const where = ['created_at >= ?'];
	const params: unknown[] = [filter.since];
	if (filter.actorId) {
		where.push('actor_id = ?');
		params.push(filter.actorId);
	}
	if (filter.kind) {
		where.push('kind = ?');
		params.push(filter.kind);
	}
	const row = await query<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM events WHERE ${where.join(' AND ')}`,
		params
	);
	return row[0]?.n ?? 0;
}
