import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getPersonFromCookie, getSession } from '$lib/server/auth';
import { getPerson } from '$lib/server/repositories/people';

export const prerender = false;

/**
 * GET /api/auth/session — current identity for the caller.
 *
 * `role` is `owner` / `member` / `null` (not a member) and comes from `people`.
 * `githubLogin` tells the comment form whether the optional GitHub upgrade is
 * usable at all (it stays hidden while unconfigured).
 */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	const session = await getSession(event, db);
	const personId = session?.personId ?? (await getPersonFromCookie(event));
	const person = personId ? await getPerson(db, personId) : null;
	const env = event.platform?.env;

	return json({
		role: session?.role ?? person?.role ?? null,
		isOwner: (session?.role ?? person?.role) === 'owner',
		githubLogin: Boolean(env?.GITHUB_CLIENT_ID && env?.GITHUB_CLIENT_SECRET),
		actor: person ? { name: person.displayName, avatarUrl: person.avatarUrl ?? null } : null
	});
};
