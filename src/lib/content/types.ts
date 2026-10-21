/** Domain types for the content platform. Storage-agnostic. */

export type NodeStatus = 'draft' | 'scheduled' | 'published' | 'archived';

/** `private` content is only readable by a signed-in owner/member. */
export type NodeVisibility = 'public' | 'private';

export interface ContentNode {
	id: string;
	type: string;
	slug: string;
	lang: string;
	/** Opaque group id (translations/series); defaults to the node's own id. */
	groupId: string;
	title: string | null;
	summary: string | null;
	bodyMd: string;
	bodyHtml: string | null;
	status: NodeStatus;
	publishedAt: string | null;
	/** When the thing happened (may predate writing it down). */
	occurredAt: string | null;
	visibility: NodeVisibility;
	/** Cross-type: shown in home selections. */
	featured: boolean;
	/** Cross-type: the cover is a media row, not a URL. */
	coverMediaId: string | null;
	/** Who recorded it — null on single-author sites. */
	authorActorId: string | null;
	createdAt: string;
	updatedAt: string;
	/** Type-specific attributes, one row per field in `node_fields`. */
	fields: Record<string, unknown>;
	/** Tags live in `node_tags` (many-to-many, aggregatable). */
	tags: string[];
	/** Media attached to this node, ordered by `media.position`. */
	media: MediaItem[];
}

export interface NewNode {
	id?: string;
	type: string;
	slug: string;
	lang?: string;
	groupId?: string | null;
	title?: string | null;
	summary?: string | null;
	bodyMd: string;
	status?: NodeStatus;
	publishedAt?: string | null;
	occurredAt?: string | null;
	visibility?: NodeVisibility;
	featured?: boolean;
	coverMediaId?: string | null;
	authorActorId?: string | null;
	fields?: Record<string, unknown>;
	tags?: string[];
}

export interface Relation {
	fromId: string;
	toId: string;
	rel: string;
}

export interface MediaItem {
	id: string;
	nodeId: string | null;
	r2Key: string;
	kind: string;
	width: number | null;
	height: number | null;
	alt: string | null;
	position: number;
	sha256: string | null;
}

export type EventKind = 'comment' | 'reaction' | 'subscribe' | 'mention' | 'pageview';
export type EventModeration = 'pending' | 'approved' | 'spam' | 'deleted';

export interface ContentEvent {
	id: string;
	kind: EventKind;
	targetType: string | null;
	targetId: string | null;
	actorId: string | null;
	parentId: string | null;
	bodyMd: string | null;
	payload: Record<string, unknown> | null;
	createdAt: string;
	/** Resolved from event_status (latest wins). */
	status?: EventModeration;
}

export interface NewEvent {
	id?: string;
	kind: EventKind;
	targetType?: string | null;
	targetId?: string | null;
	actorId?: string | null;
	parentId?: string | null;
	bodyMd?: string | null;
	payload?: Record<string, unknown> | null;
}

export type ActorKind = 'owner' | 'member' | 'visitor' | 'anonymous' | 'external';

export interface Actor {
	id: string;
	kind: ActorKind;
	handle: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	emailHash: string | null;
	createdAt: string;
}
