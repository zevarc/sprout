import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';
import { pageviewStats } from '$lib/server/stats';

export const prerender = false;

/** GET /api/admin/stats?days=30 — aggregated pageview analytics. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const days = Math.min(365, Number(event.url.searchParams.get('days') ?? 30) || 30);
	return json(await pageviewStats(db, days));
};
