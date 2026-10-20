/**
 * Media read-access policy, kept in the domain layer so routes never issue SQL.
 * Readability is the owning node's visibility; unattached/unknown = private.
 */

import type { D1Database } from '$lib/server/db';
import { first } from '$lib/server/db';

export interface MediaAccess {
	/** True when the owning node is public. */
	public: boolean;
	/** True when the object is attached to a node at all. */
	attached: boolean;
}

export async function mediaAccess(db: D1Database, r2Key: string): Promise<MediaAccess> {
	const row = await first<{ node_visibility: string | null; node_id: string | null }>(
		db,
		`SELECT n.visibility AS node_visibility, m.node_id AS node_id
		   FROM media m
		   LEFT JOIN nodes n ON n.id = m.node_id
		  WHERE m.r2_key = ?
		  LIMIT 1`,
		[r2Key]
	);
	return {
		attached: Boolean(row?.node_id),
		public: row?.node_visibility === 'public'
	};
}
