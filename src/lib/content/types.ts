/** Domain types for the content platform. Storage-agnostic. */

export type NodeStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface ContentNode {
	id: string;
	type: string;
	slug: string;
	lang: string;
	groupId: string | null;
	title: string | null;
	summary: string | null;
	bodyMd: string;
	bodyHtml: string | null;
	status: NodeStatus;
	publishedAt: string | null;
	createdAt: string;
	updatedAt: string;
	extra: Record<string, unknown>;
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
	extra?: Record<string, unknown>;
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

export type ActorKind = 'owner' | 'visitor' | 'anonymous' | 'external';

export interface Actor {
	id: string;
	kind: ActorKind;
	handle: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	emailHash: string | null;
	createdAt: string;
}
