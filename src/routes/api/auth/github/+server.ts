import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomToken } from '$lib/server/auth';

export const prerender = false;

/** GET /api/auth/github — starts the OAuth dance (optional identity upgrade). */
export const GET: RequestHandler = async (event) => {
	const clientId = event.platform?.env?.GITHUB_CLIENT_ID;
	if (!clientId) return new Response('GitHub OAuth not configured', { status: 501 });

	const state = randomToken();
	event.cookies.set('zc_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: true,
		maxAge: 600
	});

	const redirectUri = `${event.url.origin}/api/auth/github/callback`;
	const authorize = new URL('https://github.com/login/oauth/authorize');
	authorize.searchParams.set('client_id', clientId);
	authorize.searchParams.set('redirect_uri', redirectUri);
	authorize.searchParams.set('scope', 'read:user');
	authorize.searchParams.set('state', state);

	throw redirect(302, authorize.toString());
};
