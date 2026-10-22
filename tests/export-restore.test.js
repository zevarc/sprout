import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { createAsset, getAsset } from '$lib/server/repositories/assets';
import { addComment, setCommentStatus } from '$lib/server/repositories/comments';
import { addReaction } from '$lib/server/repositories/reactions';
import { createPerson, ensureOwner } from '$lib/server/repositories/people';
import { bindMedia, recordMediaObject } from '$lib/server/repositories/media';
import { buildExport } from '$lib/server/export';
import { restoreFromBundle } from '$lib/server/restore';

describe('export → restore round trip (v4)', () => {
	it('rebuilds an identical dataset — the migration guarantee', async () => {
		const source = createTestDb();
		const owner = await ensureOwner(source.db);
		const reader = await createPerson(source.db, { displayName: 'Reader', emailHash: 'h' });

		const asset = await createAsset(source.db, {
			type: 'project',
			slug: 'sprout',
			lang: 'en',
			title: 'Sprout',
			summary: 'portable',
			bodyMd: '## hi\n\n```js\n1\n```\n',
			status: 'published',
			occurredAt: '2025-01-02T00:00:00.000Z',
			visibility: 'private',
			authorId: owner.id,
			fields: { year: '2026', stage: 'active', order_index: 2 },
			tags: ['platform', 'svelte']
		});

		const mediaId = await recordMediaObject(source.db, { r2Key: 'abc.png', sha256: 'abc' });
		await bindMedia(source.db, asset.id, mediaId, { role: 'cover', alt: 'cover' });

		const comment = await addComment(source.db, {
			assetId: asset.id,
			authorId: reader.id,
			bodyMd: 'nice'
		});
		await setCommentStatus(source.db, comment.id, 'approved', owner.id);
		await addReaction(source.db, asset.id, reader.id, '👍');

		const bundle = await buildExport(source.db);
		expect(bundle.types).toEqual(['project']);
		expect(bundle.files.map((f) => f.path)).toEqual(
			expect.arrayContaining([
				'schema.json',
				'people.jsonl',
				'identities.jsonl',
				'assets.jsonl',
				'projects.jsonl',
				'comments.jsonl',
				'reactions.jsonl',
				'tags.jsonl',
				'asset_tags.jsonl',
				'media.jsonl',
				'asset_media.jsonl'
			])
		);

		const target = createTestDb();
		const result = await restoreFromBundle(target.db, bundle.files);
		expect(result.nodes).toBe(1);
		expect(result.comments).toBe(1);
		expect(result.reactions).toBe(1);
		expect(result.warnings).toEqual([]);

		const restored = await getAsset(target.db, asset.id);
		if (!restored) throw new Error('asset was not restored');
		expect(restored.title).toBe('Sprout');
		expect(restored.fields).toEqual({ year: '2026', stage: 'active', order_index: 2 });
		expect(restored.tags).toEqual(['platform', 'svelte']);
		expect(restored.coverMediaId).toBe(mediaId);
		expect(restored.visibility).toBe('private');
		expect(restored.groupId).toBe(asset.groupId);
		// `body_html` is derived, so restoring must re-render it identically.
		expect(restored.bodyHtml).toBe(asset.bodyHtml);

		// Determinism: exporting the restored database yields byte-identical files.
		const again = await buildExport(target.db);
		expect(again.files).toEqual(bundle.files);
	});

	it('skips a kind it does not know, with a warning', async () => {
		const { db } = createTestDb();
		const result = await restoreFromBundle(db, [
			{
				path: 'schema.json',
				content: JSON.stringify({ version: 4, types: ['toy'] })
			},
			{
				path: 'toys.jsonl',
				content: JSON.stringify({ id: 'x', lang: 'en', slug: 's', body_md: 'b' }) + '\n'
			}
		]);
		expect(result.warnings.join(' ')).toContain('toy');
	});

	it('refuses another export version', async () => {
		const { db } = createTestDb();
		await expect(
			restoreFromBundle(db, [{ path: 'schema.json', content: JSON.stringify({ version: 5 }) }])
		).rejects.toThrow(/newer/);
		await expect(
			restoreFromBundle(db, [{ path: 'schema.json', content: JSON.stringify({ version: 3 }) }])
		).rejects.toThrow(/older/);
	});
});
