import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestDb } from './helpers/d1-memory.js';
import { getAsset } from '$lib/server/repositories/assets';
import { restoreFromBundle } from '$lib/server/restore';
import { listComments } from '$lib/server/repositories/comments';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * @param {string} dir
 * @param {Record<string, string>} files
 */
function writeBundle(dir, files) {
	mkdirSync(dir, { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const target = join(dir, name);
		mkdirSync(join(target, '..'), { recursive: true });
		writeFileSync(target, content);
	}
}

/** @param {unknown[]} rows */
function jsonl(rows) {
	return rows.length ? rows.map((r) => JSON.stringify(r)).join('\n') + '\n' : '';
}

/** @param {string} dir @param {string} name */
function readJsonl(dir, name) {
	return readFileSync(join(dir, name), 'utf8')
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
}

describe('v3 → v4 export conversion', () => {
	it('converts a bundle that a v4 build can restore', async () => {
		const base = mkdtempSync(join(tmpdir(), 'sprout-v3v4-'));
		const input = join(base, 'v3');
		const output = join(base, 'v4');
		const now = '2025-01-01T00:00:00.000Z';

		const post = {
			id: 'N1',
			type: 'post',
			slug: 'hello',
			lang: 'en',
			group_id: 'N1',
			title: 'Hello',
			summary: 'first',
			body_md: '# hi',
			status: 'published',
			published_at: now,
			occurred_at: null,
			visibility: 'public',
			featured: 1,
			cover_media_id: 'M1',
			author_actor_id: 'A1',
			created_at: now,
			updated_at: now
		};
		const project = {
			...post,
			id: 'N2',
			type: 'project',
			slug: 'p1',
			title: 'P1',
			group_id: 'N2',
			status: 'scheduled',
			cover_media_id: null
		};

		writeBundle(input, {
			'schema.json': JSON.stringify({ version: 3, db_schema: '3', generator: 'sprout-export' }),
			'nodes.jsonl': jsonl([post, project]),
			// `year` is declared for a project but not for a post.
			'node_fields.jsonl': jsonl([
				{ node_id: 'N1', field: 'year', kind: 'text', value: '2026' },
				{ node_id: 'N2', field: 'year', kind: 'text', value: '2026' },
				{ node_id: 'N2', field: 'order_index', kind: 'number', value: 3 }
			]),
			'node_tags.jsonl': jsonl([
				{ node_id: 'N1', tag: 'one' },
				{ node_id: 'N2', tag: 'one' }
			]),
			'media.jsonl': jsonl([
				{ id: 'M1', node_id: 'N1', r2_key: 'abc.png', kind: 'image', alt: 'a', position: 0 }
			]),
			'events.jsonl': jsonl([
				{
					id: 'E1',
					kind: 'comment',
					target_type: 'post',
					target_id: 'N1',
					actor_id: 'A2',
					parent_id: null,
					body_md: 'nice',
					payload: null,
					created_at: now
				},
				{
					id: 'E2',
					kind: 'reaction',
					target_type: 'post',
					target_id: 'N1',
					actor_id: 'A2',
					parent_id: null,
					body_md: null,
					payload: { emoji: '👍' },
					created_at: now
				}
			]),
			'event_status.jsonl': jsonl([
				{ event_id: 'E1', status: 'approved', at: now, by: 'A1' }
			]),
			'actors.jsonl': jsonl([
				{ id: 'A1', kind: 'owner', display_name: 'Owner', created_at: now },
				{ id: 'A2', kind: 'anonymous', display_name: 'Reader', email_hash: 'h', created_at: now }
			]),
			'actor_identities.jsonl': jsonl([])
		});

		try {
			execFileSync(process.execPath, ['scripts/migrate-v3-to-v4.mjs', input, output], {
				cwd: ROOT,
				stdio: 'pipe'
			});

			const schema = JSON.parse(readFileSync(join(output, 'schema.json'), 'utf8'));
			expect(schema.version).toBe(4);
			expect(schema.types).toEqual(['post', 'project']);

			const [asset] = readJsonl(output, 'assets.jsonl');
			expect(asset.author_id).toBe('A1');
			// `featured` has no column in v4, and is not invented as a field.
			expect(asset).not.toHaveProperty('featured');

			const [projectRow] = readJsonl(output, 'projects.jsonl').filter((r) => r.id === 'N2');
			expect(projectRow.year).toBe('2026');
			expect(projectRow.order_index).toBe(3);
			// Nothing can schedule, so a scheduled node becomes a draft.
			expect(readJsonl(output, 'assets.jsonl').find((a) => a.id === 'N2').status).toBe('draft');

			const tags = readJsonl(output, 'tags.jsonl');
			expect(tags.map((t) => t.name)).toEqual(['one']);
			expect(readJsonl(output, 'asset_tags.jsonl')).toHaveLength(2);

			const media = readJsonl(output, 'media.jsonl');
			expect(media).toHaveLength(1);
			expect(media[0].r2_key).toBe('abc.png');
			const bindings = readJsonl(output, 'asset_media.jsonl');
			// The v3 row's alt belongs to this use, so it rides along with the binding.
			expect(bindings).toEqual([
				{ asset_id: 'N1', media_id: media[0].id, position: 0, alt: 'a', role: 'cover' }
			]);

			expect(readJsonl(output, 'comments.jsonl')[0]).toMatchObject({
				id: 'E1',
				asset_id: 'N1',
				author_id: 'A2',
				status: 'approved'
			});
			expect(readJsonl(output, 'reactions.jsonl')[0]).toMatchObject({
				asset_id: 'N1',
				person_id: 'A2',
				emoji: '👍'
			});
			expect(readJsonl(output, 'people.jsonl').map((p) => p.role)).toEqual(['owner', null]);

			// The real proof: a v4 build restores the converted bundle.
			const { db } = createTestDb();
			const files = [
				'schema.json',
				'people.jsonl',
				'identities.jsonl',
				'assets.jsonl',
				'posts.jsonl',
				'projects.jsonl',
				'comments.jsonl',
				'reactions.jsonl',
				'tags.jsonl',
				'asset_tags.jsonl',
				'media.jsonl',
				'asset_media.jsonl'
			]
				.filter((name) => {
					try {
						readFileSync(join(output, name));
						return true;
					} catch {
						return false;
					}
				})
				.map((name) => ({ path: name, content: readFileSync(join(output, name), 'utf8') }));

			const result = await restoreFromBundle(db, files);
			expect(result.warnings).toEqual([]);
			const restored = await getAsset(db, 'N1');
			expect(restored?.title).toBe('Hello');
			expect(restored?.tags).toEqual(['one']);
			expect(restored?.coverMediaId).toBe(media[0].id);
			const comments = await listComments(db, { assetId: 'N1', status: 'approved' });
			expect(comments).toHaveLength(1);
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});

	it('reports a field the target kind does not declare', () => {
		const base = mkdtempSync(join(tmpdir(), 'sprout-v3v4-warn-'));
		const input = join(base, 'v3');
		const output = join(base, 'v4');
		const now = '2025-01-01T00:00:00.000Z';
		writeBundle(input, {
			'schema.json': JSON.stringify({ version: 3 }),
			'nodes.jsonl': jsonl([
				{
					id: 'N1',
					type: 'post',
					slug: 'hello',
					lang: 'en',
					group_id: 'N1',
					title: 'Hello',
					summary: '',
					body_md: 'x',
					status: 'published',
					published_at: now,
					occurred_at: null,
					visibility: 'public',
					author_actor_id: 'A1',
					created_at: now,
					updated_at: now
				}
			]),
			'node_fields.jsonl': jsonl([{ node_id: 'N1', field: 'price', kind: 'number', value: 9 }]),
			'node_tags.jsonl': '',
			'media.jsonl': '',
			'events.jsonl': '',
			'event_status.jsonl': '',
			'actors.jsonl': jsonl([{ id: 'A1', kind: 'owner', display_name: 'O', created_at: now }]),
			'actor_identities.jsonl': ''
		});

		try {
			const stdout = execFileSync(
				process.execPath,
				['scripts/migrate-v3-to-v4.mjs', input, output],
				{ cwd: ROOT, encoding: 'utf8' }
			);
			expect(stdout).toContain('not declared');
			expect(stdout).toContain('price');
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});

	it('synthesizes an owner when the v3 bundle has no actors', async () => {
		const base = mkdtempSync(join(tmpdir(), 'sprout-v3v4-owner-'));
		const input = join(base, 'v3');
		const output = join(base, 'v4');
		const now = '2025-01-01T00:00:00.000Z';

		// The demo's real shape: filled through the API with a Bearer token, so no
		// actor row was ever created and every author is null.
		writeBundle(input, {
			'schema.json': JSON.stringify({ version: 3 }),
			'nodes.jsonl': jsonl([
				{
					id: 'N1',
					type: 'post',
					slug: 'hello',
					lang: 'en',
					group_id: 'N1',
					title: 'Hello',
					summary: '',
					body_md: 'x',
					status: 'published',
					published_at: now,
					occurred_at: null,
					visibility: 'public',
					author_actor_id: null,
					created_at: now,
					updated_at: now
				}
			]),
			'node_fields.jsonl': '',
			'node_tags.jsonl': '',
			'media.jsonl': '',
			'events.jsonl': '',
			'event_status.jsonl': '',
			'actors.jsonl': '',
			'actor_identities.jsonl': ''
		});

		try {
			const stdout = execFileSync(
				process.execPath,
				['scripts/migrate-v3-to-v4.mjs', input, output],
				{ cwd: ROOT, encoding: 'utf8' }
			);
			expect(stdout).toContain('synthesized');

			const people = readJsonl(output, 'people.jsonl');
			expect(people).toHaveLength(1);
			expect(people[0].role).toBe('owner');
			const [asset] = readJsonl(output, 'assets.jsonl');
			expect(asset.author_id).toBe(people[0].id);

			// And the v4 build restores it.
			const { db } = createTestDb();
			const files = ['schema.json', 'people.jsonl', 'assets.jsonl', 'posts.jsonl']
				.filter((name) => {
					try {
						readFileSync(join(output, name));
						return true;
					} catch {
						return false;
					}
				})
				.map((name) => ({ path: name, content: readFileSync(join(output, name), 'utf8') }));
			const result = await restoreFromBundle(db, files);
			expect(result.warnings).toEqual([]);
			expect((await getAsset(db, 'N1'))?.authorId).toBe(people[0].id);
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});
});
