import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { issuePersonCookie, safeNextPath } from '$lib/server/auth';
import { site } from '$lib/site';
import {
	createPerson,
	getPersonByIdentity,
	linkIdentity
} from '$lib/server/repositories/people';

export const prerender = false;

interface GitHubUser {
	id: number;
	login: string;
	name: string | null;
	avatar_url: string | null;
}

/** GET /api/auth/github/callback — links the GitHub identity to a local person. */
export const GET: RequestHandler = async (event) => {
	const clientId = event.platform?.env?.GITHUB_CLIENT_ID;
	const clientSecret = event.platform?.env?.GITHUB_CLIENT_SECRET;
	if (!clientId || !clientSecret) return new Response('GitHub OAuth not configured', { status: 501 });

	const code = event.url.searchParams.get('code');
	const state = event.url.searchParams.get('state');
	const expected = event.cookies.get('zc_oauth_state');
	event.cookies.delete('zc_oauth_state', { path: '/' });

	if (!code || !state || state !== expected) {
		return new Response('Invalid OAuth state', { status: 400 });
	}

	const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({
			client_id: clientId,
			client_secret: clientSecret,
			code,
			redirect_uri: `${event.url.origin}/api/auth/github/callback`
		})
	});
	const tokenData = (await tokenRes.json()) as { access_token?: string };
	if (!tokenData.access_token) return new Response('OAuth exchange failed', { status: 400 });

	const userRes = await fetch('https://api.github.com/user', {
		headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': site.name }
	});
	if (!userRes.ok) return new Response('Failed to load GitHub profile', { status: 400 });
	const user = (await userRes.json()) as GitHubUser;

	const db = getDb(event.platform);
	const providerUid = String(user.id);
	let person = await getPersonByIdentity(db, 'github', providerUid);
	if (!person) {
		person = await createPerson(db, {
			handle: user.login,
			displayName: user.name || user.login,
			avatarUrl: user.avatar_url
		});
		await linkIdentity(db, person.id, 'github', providerUid);
	}

	await issuePersonCookie(event, person.id);
	// Send the visitor back to the page they started from (defaults to home).
	const next = safeNextPath(event.cookies.get('zc_oauth_next')) ?? '/';
	event.cookies.delete('zc_oauth_next', { path: '/' });
	throw redirect(302, next);
};
