import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/d1-memory.js';
import { createNode, getNode } from '$lib/server/repositories/nodes';
import { addEvent, setEventStatus } from '$lib/server/repositories/events';
import { createActor } from '$lib/server/repositories/actors';
import { buildExport } from '$lib/server/export';
import { restoreFromBundle } from '$lib/server/restore';
import { run } from '$lib/server/db';

describe('export → restore round trip', () => {
	it('rebuilds an identical dataset (this is the migration guarantee)', async () => {
		const source = createTestDb();

		const author = await createActor(source.db, { kind: 'owner', displayName: 'Owner' });
		const commenter = await createActor(source.db, {
			kind: 'anonymous',
			displayName: 'Alice',
			emailHash: 'hashed'
		});

		const node = await createNode(source.db, {
			type: 'toy',
			slug: 'blocks',
			lang: 'zh',
			title: '积木',
			summary: '很耐玩',
			bodyMd: '## 小节\n\n```cpp\nint main(){}\n```\n',
			status: 'published',
			occurredAt: '2025-01-02T00:00:00.000Z',
			visibility: 'private',
			featured: true,
			authorActorId: author.id,
			fields: { rating: '5', price: 128, pros: '耐摔', sturdy: true },
			tags: ['益智', '积木']
		});

		// Attach media and point the cover at it.
		await run(
			source.db,
			`INSERT INTO media (id, node_id, r2_key, kind, position) VALUES ('m1', ?, 'abc.png', 'image', 0)`,
			[node.id]
		);
		await run(source.db, 'UPDATE nodes SET cover_media_id = ? WHERE id = ?', ['m1', node.id]);

		const event = await addEvent(source.db, {
			kind: 'comment',
			targetType: 'toy',
			targetId: node.id,
			actorId: commenter.id,
			bodyMd: 'hi',
			payload: { ipHash: 'x' }
		});
		await setEventStatus(source.db, event.id, 'approved', null);

		const bundle = await buildExport(source.db);
		expect(bundle.nodeCount).toBe(1);
		expect(bundle.eventCount).toBe(1);
		expect(bundle.files.some((f) => f.path === 'node_fields.jsonl')).toBe(true);
		expect(bundle.files.some((f) => f.path === 'node_tags.jsonl')).toBe(true);

		const target = createTestDb();
		const result = await restoreFromBundle(target.db, bundle.files);

		expect(result).toEqual({
			nodes: 1,
			events: 1,
			actors: 2,
			relations: 0,
			fields: 4,
			tags: 2
		});

		const restored = await getNode(target.db, node.id);
		if (!restored) throw new Error('node was not restored');
		expect(restored.title).toBe('积木');
		expect(restored.fields).toEqual({ rating: '5', price: 128, pros: '耐摔', sturdy: true });
		expect(restored.tags).toEqual(['益智', '积木']);
		expect(restored.featured).toBe(true);
		expect(restored.coverMediaId).toBe('m1');
		expect(restored.media.map((m) => m.r2Key)).toEqual(['abc.png']);
		// Visibility / occurred time / authorship / grouping must survive.
		expect(restored.visibility).toBe('private');
		expect(restored.occurredAt).toBe('2025-01-02T00:00:00.000Z');
		expect(restored.authorActorId).toBe(author.id);
		expect(restored.groupId).toBe(node.groupId);
		// `body_html` is derived, so restoring must re-render it identically.
		expect(restored.bodyHtml).toBe(node.bodyHtml);

		/** @param {string} sql */
		const count = (sql) => {
			const row = /** @type {{ n: number }} */ (target.sqlite.prepare(sql).get());
			return Number(row.n);
		};
		expect(count('SELECT COUNT(*) AS n FROM nodes_fts')).toBe(1);
		expect(count('SELECT COUNT(*) AS n FROM media')).toBe(1);
		expect(count('SELECT COUNT(*) AS n FROM node_fields')).toBe(4);
		expect(count('SELECT COUNT(*) AS n FROM node_tags')).toBe(2);
		expect(count('SELECT COUNT(*) AS n FROM event_status')).toBe(1);
		expect(count('SELECT COUNT(*) AS n FROM relations')).toBe(0);

		// Determinism: exporting the restored database yields byte-identical files.
		const again = await buildExport(target.db);
		expect(again.files).toEqual(bundle.files);
	});

	it('refuses a bundle from a different export version', async () => {
		const { db } = createTestDb();
		await expect(
			restoreFromBundle(db, [
				{ path: 'schema.json', content: JSON.stringify({ version: 4 }) }
			])
		).rejects.toThrow(/newer/);

		await expect(
			restoreFromBundle(db, [
				{ path: 'schema.json', content: JSON.stringify({ version: 2 }) }
			])
		).rejects.toThrow(/older/);
	});
});
