import { getDb } from '$lib/server/db';
import { listTags } from '$lib/server/repositories/nodes';
import { localeFromPath } from '$lib/i18n';

export const prerender = false;

export async function load({ platform, url }) {
	const db = getDb(platform);
	const lang = localeFromPath(url.pathname);
	const tags = await listTags(db, { lang, types: ['post', 'note'] });
	return { tags, lang };
}
