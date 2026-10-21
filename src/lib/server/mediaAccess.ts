/**
 * Media read-access policy, kept in the domain layer so routes never issue SQL.
 *
 * Media keys are content-addressed, so the *same* object can be attached to
 * several nodes. Readability is therefore: **public if any owning node is
 * public**; unknown or unattached objects are private. Looking at a single row
 * would make the answer depend on row order.
 */

import type { D1Database } from '$lib/server/db';
import { first } from '$lib/server/db';

export interface MediaAccess {
	/** True when at least one owning node is public. */
	public: boolean;
	/** True when the object is attached to a node at all. */
	attached: boolean;
}

export async function mediaAccess(db: D1Database, r2Key: string): Promise<MediaAccess> {
	const row = await first<{ any_public: number | null; attachments: number }>(
		db,
		`SELECT
		   MAX(CASE WHEN n.visibility = 'public' THEN 1 ELSE 0 END) AS any_public,
		   COUNT(*) AS attachments
		 FROM media m
		 LEFT JOIN nodes n ON n.id = m.node_id
		 WHERE m.r2_key = ?`,
		[r2Key]
	);
	return {
		attached: Number(row?.attachments ?? 0) > 0,
		public: Number(row?.any_public ?? 0) === 1
	};
}
