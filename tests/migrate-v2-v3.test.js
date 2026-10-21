import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * @param {string} dir
 * @param {Record<string, string>} files
 */
function writeBundle(dir, files) {
	mkdirSync(dir, { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		writeFileSync(join(dir, name), content);
	}
}

/** @param {unknown[]} rows */
function jsonl(rows) {
	return rows.length ? rows.map((r) => JSON.stringify(r)).join('\n') + '\n' : '';
}

/**
 * @param {string} dir
 * @param {string} name
 */
function readJsonl(dir, name) {
	const text = readFileSync(join(dir, name), 'utf8');
	return text
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => JSON.parse(line));
}

describe('v2 → v3 export conversion', () => {
	it('splits extra into fields, tags and media references', () => {
		const base = mkdtempSync(join(tmpdir(), 'sprout-v2v3-'));
		const input = join(base, 'v2');
		const output = join(base, 'v3');

		const node = {
			id: 'N1',
			type: 'toy',
			slug: 'blocks',
			lang: 'zh',
			group_id: 'N1',
			title: '积木',
			summary: '',
			body_md: '# x',
			status: 'published',
			published_at: '2025-01-01T00:00:00.000Z',
			occurred_at: null,
			visibility: 'public',
			author_actor_id: null,
			created_at: '2025-01-01T00:00:00.000Z',
			updated_at: '2025-01-01T00:00:00.000Z',
			extra: {
				description: '很耐玩',
				tags: ['益智', '积木'],
				featured: true,
				cover: '/media/cover.png',
				images: ['/media/g1.png'],
				rating: '5',
				price: 128,
				pros: '耐摔',
				createdAt: 'ignored',
				updatedAt: 'ignored'
			}
		};

		writeBundle(input, {
			'schema.json': JSON.stringify({ version: 2, db_schema: '2', generator: 'sprout-export' }),
			'nodes.jsonl': jsonl([node]),
			'media.jsonl': '',
			'relations.jsonl': '',
			'events.jsonl': '',
			'event_status.jsonl': '',
			'actors.jsonl': '',
			'actor_identities.jsonl': ''
		});

		try {
			execFileSync(process.execPath, ['scripts/migrate-v2-to-v3.mjs', input, output], {
				cwd: ROOT,
				stdio: 'pipe'
			});

			const schema = JSON.parse(readFileSync(join(output, 'schema.json'), 'utf8'));
			expect(schema.version).toBe(3);
			expect(schema.tables).toContain('node_fields');
			expect(schema.tables).toContain('node_tags');

			const [converted] = readJsonl(output, 'nodes.jsonl');
			expect(converted.extra).toBeUndefined();
			expect(converted.summary).toBe('很耐玩');
			expect(converted.featured).toBe(1);
			expect(converted.cover_media_id).toBeTruthy();

			const fields = readJsonl(output, 'node_fields.jsonl');
			const byKey = Object.fromEntries(fields.map((f) => [f.field, f]));
			expect(byKey.rating).toEqual({ node_id: 'N1', field: 'rating', kind: 'text', value: '5' });
			expect(byKey.price).toEqual({ node_id: 'N1', field: 'price', kind: 'number', value: 128 });
			expect(byKey.pros.value).toBe('耐摔');
			// Misused v2 keys must not become fields.
			expect(byKey.description).toBeUndefined();
			expect(byKey.createdAt).toBeUndefined();

			const tags = readJsonl(output, 'node_tags.jsonl').map((r) => r.tag);
			expect(tags).toEqual(['益智', '积木']);

			const media = readJsonl(output, 'media.jsonl');
			expect(media.map((m) => m.r2_key).sort()).toEqual(['cover.png', 'g1.png']);
			expect(media.find((m) => m.r2_key === 'cover.png').id).toBe(converted.cover_media_id);

			const md = readFileSync(join(output, 'nodes/toy/blocks.zh.md'), 'utf8');
			expect(md).toContain('fields: {"price":128,"pros":"耐摔","rating":"5"}');
			expect(md).toContain('tags: ["益智","积木"]');
		} finally {
			rmSync(base, { recursive: true, force: true });
		}
	});
});
