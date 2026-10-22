/**
 * Media read-access policy, kept in the domain layer so routes never issue SQL.
 *
 * Keys are content-addressed, so one object can be bound to several assets. An
 * object is public **only when every asset that binds it is public**; unknown or
 * unbound objects are private (docs/DATA-MODEL.md §4.10).
 */

import type { D1Database } from '$lib/server/db';
import { mediaVisibility } from '$lib/server/repositories/media';

export interface MediaAccess {
	/** True when at least one asset binds the object. */
	attached: boolean;
	/** True when every binding is public. */
	public: boolean;
}

export async function mediaAccess(db: D1Database, r2Key: string): Promise<MediaAccess> {
	return mediaVisibility(db, r2Key);
}
