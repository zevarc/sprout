import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, query } from '$lib/server/db';
import { isAdmin } from '$lib/server/auth';

export const prerender = false;

function daysAgo(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

/** GET /api/admin/stats?days=30 — aggregated pageview analytics. */
export const GET: RequestHandler = async (event) => {
	const db = getDb(event.platform);
	if (!(await isAdmin(event, db))) return json({ error: 'unauthorized' }, { status: 401 });

	const days = Math.min(365, Number(event.url.searchParams.get('days') ?? 30) || 30);
	const since = daysAgo(days);

	const totals = await query<{ views: number; paths: number }>(
		db,
		'SELECT COALESCE(SUM(views),0) AS views, COUNT(DISTINCT path) AS paths FROM stats_daily WHERE day >= ?',
		[since]
	);
	const byDay = await query<{ day: string; views: number }>(
		db,
		'SELECT day, SUM(views) AS views FROM stats_daily WHERE day >= ? GROUP BY day ORDER BY day DESC',
		[since]
	);
	const topPaths = await query<{ path: string; views: number }>(
		db,
		'SELECT path, SUM(views) AS views FROM stats_daily WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 15',
		[since]
	);
	const referrers = await query<{ referrer: string; views: number }>(
		db,
		"SELECT referrer, SUM(views) AS views FROM stats_daily WHERE day >= ? AND referrer != '' GROUP BY referrer ORDER BY views DESC LIMIT 10",
		[since]
	);

	return json({
		days,
		totals: totals[0] ?? { views: 0, paths: 0 },
		byDay,
		topPaths,
		referrers
	});
};
