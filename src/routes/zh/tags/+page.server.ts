import { getDb } from '$lib/server/db';
import { listTags } from '$lib/server/repositories/nodes';

export const prerender = false;

export async function load({ platform }) {
	const db = getDb(platform);
	const tags = await listTags(db, { lang: 'zh', types: ['post', 'note'] });
	return { tags };
}
