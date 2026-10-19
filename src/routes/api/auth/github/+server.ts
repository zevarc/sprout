import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomToken, safeNextPath } from '$lib/server/auth';

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

	// Remember where the visitor was, so the callback can send them back there.
	const next = safeNextPath(event.url.searchParams.get('next'));
	if (next) {
		event.cookies.set('zc_oauth_next', next, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 600
		});
	} else {
		event.cookies.delete('zc_oauth_next', { path: '/' });
	}

	const redirectUri = `${event.url.origin}/api/auth/github/callback`;
	const authorize = new URL('https://github.com/login/oauth/authorize');
	authorize.searchParams.set('client_id', clientId);
	authorize.searchParams.set('redirect_uri', redirectUri);
	authorize.searchParams.set('scope', 'read:user');
	authorize.searchParams.set('state', state);

	throw redirect(302, authorize.toString());
};
