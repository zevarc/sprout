import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderComment } from '$lib/server/render';
import { extractHeadings } from '$lib/reading';

describe('markdown rendering', () => {
	it('produces the same heading ids as the TOC extractor', async () => {
		const md = '## 构建 指南\n\n### Setup\n\n## 构建 指南';
		const html = await renderMarkdown(md);

		const ids = [...html.matchAll(/<h[2-4] id="([^"]+)"/g)].map((m) => m[1]);
		const tocIds = extractHeadings(md).map((h) => h.id);

		expect(ids).toEqual(tocIds);
		expect(ids).toEqual(['构建-指南', 'setup', '构建-指南-1']);
	});

	it('escapes raw HTML in user comments (XSS)', async () => {
		const html = await renderComment('<script>alert(1)</script>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('allows raw HTML in trusted author content', async () => {
		const html = await renderMarkdown('<div class="x">ok</div>');
		expect(html).toContain('<div class="x">ok</div>');
	});

	it('wraps code fences for client-side highlighting', async () => {
		const html = await renderMarkdown('```cpp\nint main(){}\n```');
		expect(html).toContain('class="code-pre"');
		expect(html).toContain('data-lang="cpp"');
		expect(html).toContain('class="language-cpp"');
	});

	it('falls back to plain text for unknown languages', async () => {
		const html = await renderMarkdown('```not-a-language\nhello\n```');
		expect(html).toContain('data-lang="text"');
	});
});
