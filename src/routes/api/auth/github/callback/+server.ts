import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { issueActorCookie } from '$lib/server/auth';
import { site } from '$lib/site';
import {
	createActor,
	getActorByIdentity,
	linkIdentity
} from '$lib/server/repositories/actors';

export const prerender = false;

interface GitHubUser {
	id: number;
	login: string;
	name: string | null;
	avatar_url: string | null;
}

/** GET /api/auth/github/callback — links the GitHub identity to a local actor. */
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
	let actor = await getActorByIdentity(db, 'github', providerUid);
	if (!actor) {
		actor = await createActor(db, {
			kind: 'visitor',
			handle: user.login,
			displayName: user.name || user.login,
			avatarUrl: user.avatar_url
		});
		await linkIdentity(db, actor.id, 'github', providerUid);
	}

	await issueActorCookie(event, actor.id);
	throw redirect(302, '/');
};
