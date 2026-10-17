import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, run } from '$lib/server/db';
import { site } from '$lib/site';

export const prerender = false;

/**
 * Privacy-preserving pageview beacon. No cookies, no IP, no user id — only an
 * aggregated (day, path, referrer-domain) counter.
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	if (!site.features.analytics) return json({ ok: true });

	const db = getDb(platform);

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false }, { status: 400 });
	}

	const path = String(body.path ?? '').slice(0, 200);
	if (!path) return json({ ok: false }, { status: 400 });

	let referrer = '';
	if (body.referrer) {
		try {
			referrer = new URL(String(body.referrer)).hostname.slice(0, 120);
		} catch {
			referrer = '';
		}
	}

	const day = new Date().toISOString().slice(0, 10);
	await run(
		db,
		`INSERT INTO stats_daily (day, path, referrer, views) VALUES (?, ?, ?, 1)
		 ON CONFLICT (day, path, referrer) DO UPDATE SET views = views + 1`,
		[day, path, referrer]
	);

	return json({ ok: true });
};
