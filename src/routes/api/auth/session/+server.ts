import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getActorFromCookie, getSession } from '$lib/server/auth';
import { getActor } from '$lib/server/repositories/actors';

export const prerender = false;

/**
 * GET /api/auth/session — current identity for the caller.
 *
 * `githubLogin` tells the comment form whether the optional "sign in with
 * GitHub" upgrade is usable at all (it stays hidden while unconfigured).
 */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	const session = await getSession(event, db);
	const actorId = session?.actorId ?? (await getActorFromCookie(event));
	const actor = actorId ? await getActor(db, actorId) : null;
	const env = event.platform?.env;

	return json({
		role: session?.role ?? 'visitor',
		isOwner: session?.role === 'owner',
		githubLogin: Boolean(env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET),
		actor: actor ? { name: actor.displayName, avatarUrl: actor.avatarUrl ?? null } : null
	});
};
