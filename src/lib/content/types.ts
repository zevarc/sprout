/**
 * Domain types for the content platform. Storage-agnostic; the schema they map
 * to is docs/DATA-MODEL.md (shared `assets` row + one table per content kind).
 */

/** Publication state. There is no `scheduled`: nothing in the system can schedule. */
export type AssetStatus = 'draft' | 'published' | 'archived';

/** `private` content is readable only by a signed-in owner/member. */
export type Visibility = 'public' | 'private';

/** Authority. `null` means "not a member" (visitor, anonymous commenter). */
export type PersonRole = 'owner' | 'member';

export type CommentStatus = 'pending' | 'approved' | 'spam' | 'deleted';

export interface Person {
	id: string;
	role: PersonRole | null;
	handle: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	emailHash: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface NewPerson {
	role?: PersonRole | null;
	handle?: string | null;
	displayName?: string | null;
	avatarUrl?: string | null;
	emailHash?: string | null;
}

/**
 * One piece of content: the shared `assets` row joined with its kind's own row.
 * `fields` holds the kind's declared attributes (real columns on the kind table),
 * which is what the site config declares and the admin editor edits.
 */
export interface ContentNode {
	id: string;
	/** Which kind table holds the content: `post` | `note` | `moment` | `project` | … */
	type: string;
	lang: string;
	/** Opaque group id (translations/series); defaults to the asset's own id. */
	groupId: string;
	slug: string;
	title: string | null;
	summary: string | null;
	bodyMd: string;
	bodyHtml: string | null;
	status: AssetStatus;
	publishedAt: string | null;
	/** When the thing happened (may predate writing it down). */
	occurredAt: string | null;
	visibility: Visibility;
	/** Who recorded it. Never null: a single-author site points at the owner. */
	authorId: string;
	createdAt: string;
	updatedAt: string;
	/** The kind's declared attributes (real columns on the kind table). */
	fields: Record<string, unknown>;
	/** Tags live in `tags` + `asset_tags`. */
	tags: string[];
	/** Media bound to this asset, ordered by `asset_media.position`. */
	media: MediaItem[];
	/** The asset's cover binding, if any (`asset_media.role = 'cover'`). */
	coverMediaId: string | null;
}

export interface NewAsset {
	/** Generated when omitted; ids are never derived from content. */
	id?: string;
	type: string;
	slug: string;
	lang?: string;
	groupId?: string | null;
	title?: string | null;
	summary?: string | null;
	bodyMd: string;
	status?: AssetStatus;
	publishedAt?: string | null;
	occurredAt?: string | null;
	visibility?: Visibility;
	/** Required: assign the site owner when there is no session. */
	authorId: string;
	fields?: Record<string, unknown>;
	tags?: string[];
}

/** One media row bound to an asset, as the views need it. */
export interface MediaItem {
	id: string;
	r2Key: string;
	kind: string;
	alt: string | null;
	position: number;
	role: 'body' | 'cover';
	sha256: string | null;
}

export interface Comment {
	id: string;
	assetId: string;
	parentId: string | null;
	authorId: string;
	bodyMd: string;
	status: CommentStatus;
	moderatedAt: string | null;
	moderatedBy: string | null;
	payload: Record<string, unknown> | null;
	createdAt: string;
}

export interface NewComment {
	id?: string;
	assetId: string;
	parentId?: string | null;
	authorId: string;
	bodyMd: string;
	payload?: Record<string, unknown> | null;
}
