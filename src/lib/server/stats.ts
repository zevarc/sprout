/**
 * Self-hosted, cookie-free analytics. Aggregated on write; never exported.
 */

import type { D1Database } from '$lib/server/db';
import { query, run } from '$lib/server/db';

/** Adds one view to the (day, path, referrer) counter. */
export async function recordPageview(
	db: D1Database,
	path: string,
	referrer: string
): Promise<void> {
	const day = new Date().toISOString().slice(0, 10);
	await run(
		db,
		`INSERT INTO stats_daily (day, path, referrer, views) VALUES (?, ?, ?, 1)
		 ON CONFLICT (day, path, referrer) DO UPDATE SET views = views + 1`,
		[day, path, referrer]
	);
}

function daysAgo(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

export interface PageviewStats {
	days: number;
	totals: { views: number; paths: number };
	byDay: { day: string; views: number }[];
	topPaths: { path: string; views: number }[];
	referrers: { referrer: string; views: number }[];
}

export async function pageviewStats(db: D1Database, days: number): Promise<PageviewStats> {
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

	return {
		days,
		totals: totals[0] ?? { views: 0, paths: 0 },
		byDay,
		topPaths,
		referrers
	};
}
