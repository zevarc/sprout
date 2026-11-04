import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getContentType } from '$lib/content/registry';
import { hashIp } from '$lib/server/auth';
import {
	addApplication,
	countApplicationsSince,
	hasFriendApplications,
	hasPendingApplication
} from '$lib/server/repositories/friendApplications';
import { checkReciprocal, normalizeEmail, normalizeSiteUrl } from '$lib/server/friends';
import { site } from '$lib/site';

export const prerender = false;

const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_MAX = 3;
const MAX_NAME = 80;
const MAX_DESCRIPTION = 300;
const MAX_MESSAGE = 1000;

/** Only locales the site declares — never a client-supplied label. */
function resolveLang(value: unknown): string {
	const code = String(value ?? '');
	return site.locales.some((l) => l.code === code) ? code : site.defaultLocale;
}

/** Trims, collapses blank to null, and enforces a length cap. */
function text(value: unknown, max: number): string | null {
	const out = String(value ?? '').trim();
	if (!out) return null;
	return out.slice(0, max);
}

/**
 * POST /api/friends/apply — a public friend-link request.
 *
 * The endpoint exists only when the site declares the `friend` kind *and* the
 * application table is present (the migration is the opt-in, like `/blogroll`).
 * Nothing is published here: an admin has to approve the request first.
 */
export const POST: RequestHandler = async (event) => {
	const type = getContentType('friend');
	if (!type?.public) return json({ error: 'not found' }, { status: 404 });

	const db = getDb(event.platform);
	if (!(await hasFriendApplications(db))) return json({ error: 'not found' }, { status: 404 });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid json' }, { status: 400 });
	}

	// Honeypot: bots fill hidden fields. Answer like a success so they retry.
	if (typeof body.website === 'string' && body.website.trim() !== '') {
		return json({ ok: true });
	}

	const name = text(body.name, MAX_NAME);
	if (!name) return json({ error: 'name required' }, { status: 400 });

	const url = normalizeSiteUrl(body.url);
	if (!url) return json({ error: 'invalid url' }, { status: 400 });

	const description = text(body.description, MAX_DESCRIPTION);
	const message = text(body.message, MAX_MESSAGE);

	const avatarUrl = body.avatar?.toString().trim() ? normalizeSiteUrl(body.avatar) : null;
	if (body.avatar && !avatarUrl) return json({ error: 'invalid avatar url' }, { status: 400 });

	const feedUrl = body.feed?.toString().trim() ? normalizeSiteUrl(body.feed) : null;
	if (body.feed && !feedUrl) return json({ error: 'invalid feed url' }, { status: 400 });

	const linksPage = body.linksPage?.toString().trim() ? normalizeSiteUrl(body.linksPage) : null;
	if (body.linksPage && !linksPage) return json({ error: 'invalid links page url' }, { status: 400 });

	const email = normalizeEmail(body.email);
	if (body.email && !email) return json({ error: 'invalid email' }, { status: 400 });

	const lang = resolveLang(body.lang);

	// Rate limit before any remote fetch: the probe below must never be free.
	const env = event.platform?.env;
	let sourceHash: string | null = null;
	try {
		const ip = event.getClientAddress();
		if (ip && env?.IP_HASH_SALT) {
			// One bucket per day, so the hash cannot be used to track across days.
			sourceHash = await hashIp(ip, env.IP_HASH_SALT, new Date().toISOString().slice(0, 10));
			const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
			if ((await countApplicationsSince(db, sourceHash, since)) >= RATE_MAX) {
				return json({ error: 'too many requests' }, { status: 429 });
			}
		}
	} catch {
		/* address unavailable — skip the limit rather than block everyone */
	}

	// One pending request per site. The partial unique index backs this up.
	if (await hasPendingApplication(db, url)) {
		return json({ error: 'already pending' }, { status: 409 });
	}

	const reciprocal = await checkReciprocal(url);

	let application;
	try {
		application = await addApplication(db, {
			name,
			url,
			description,
			avatarUrl,
			feedUrl,
			linksPage,
			email,
			message,
			lang,
			reciprocal,
			sourceHash
		});
	} catch (error) {
		// The partial unique index is the last line of defence against a race.
		if (String(error instanceof Error ? error.message : error).includes('UNIQUE')) {
			return json({ error: 'already pending' }, { status: 409 });
		}
		throw error;
	}

	return json({ ok: true, id: application.id });
};
