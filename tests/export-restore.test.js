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

		const node = await createNode(source.db, {
			id: 'post:hello:en',
			type: 'post',
			slug: 'hello',
			lang: 'en',
			title: 'Hello 构建',
			summary: '摘要',
			bodyMd: '## 小节\n\n```cpp\nint main(){}\n```\n\nThe end.',
			status: 'published',
			extra: { tags: ['a', 'b'] }
		});

		const actor = await createActor(source.db, {
			kind: 'anonymous',
			displayName: 'Alice',
			emailHash: 'hashed'
		});
		const event = await addEvent(source.db, {
			kind: 'comment',
			targetType: 'post',
			targetId: node.id,
			actorId: actor.id,
			bodyMd: 'hi'
		});
		await setEventStatus(source.db, event.id, 'approved', null);

		await run(source.db, `INSERT INTO relations (from_id, to_id, rel) VALUES (?, ?, 'translation')`, [
			node.id,
			'post:hello:zh'
		]);
		await run(
			source.db,
			`INSERT INTO media (id, node_id, r2_key, kind, position) VALUES ('m1', ?, 'abc.png', 'image', 0)`,
			[node.id]
		);

		const bundle = await buildExport(source.db);
		expect(bundle.nodeCount).toBe(1);
		expect(bundle.eventCount).toBe(1);

		// Restore into a fresh database.
		const target = createTestDb();
		const result = await restoreFromBundle(target.db, bundle.files);

		expect(result).toEqual({ nodes: 1, events: 1, actors: 1, relations: 1 });

		const restored = await getNode(target.db, 'post:hello:en');
		if (!restored) throw new Error('node was not restored');
		expect(restored.title).toBe('Hello 构建');
		expect(restored.extra).toEqual({ tags: ['a', 'b'] });
		// `body_html` is derived, so restoring must re-render it identically.
		expect(restored.bodyHtml).toBe(node.bodyHtml);

		/** @param {string} sql */
		const count = (sql) => {
			const row = /** @type {{ n: number }} */ (target.sqlite.prepare(sql).get());
			return Number(row.n);
		};
		expect(count('SELECT COUNT(*) AS n FROM nodes_fts')).toBe(1);
		expect(count('SELECT COUNT(*) AS n FROM relations')).toBe(1);
		expect(count('SELECT COUNT(*) AS n FROM media')).toBe(1);
		expect(count('SELECT COUNT(*) AS n FROM event_status')).toBe(1);

		// Determinism: exporting the restored database yields byte-identical files.
		const again = await buildExport(target.db);
		expect(again.files).toEqual(bundle.files);
	});
});
