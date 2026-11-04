import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderComment, extractHeadings } from '$lib/server/render';

/** Heading ids as they appear in the rendered body.
 * @param {string} html */
const renderedIds = (html) => [...html.matchAll(/<h[2-4] id="([^"]+)"/g)].map((m) => m[1]);

describe('markdown rendering', () => {
	it('produces the same heading ids as the TOC extractor', async () => {
		const md = '## 构建 指南\n\n### Setup\n\n## 构建 指南';
		const html = await renderMarkdown(md);

		expect(renderedIds(html)).toEqual(extractHeadings(md).map((h) => h.id));
		expect(renderedIds(html)).toEqual(['构建-指南', 'setup', '构建-指南-1']);
	});

	it('ignores headings that only exist inside a code fence', async () => {
		const md = ['## 真标题', '', '```md', '## 假标题', '```', '', '    ## 缩进的代码'].join('\n');
		const html = await renderMarkdown(md);

		expect(extractHeadings(md).map((h) => h.text)).toEqual(['真标题']);
		expect(renderedIds(html)).toEqual(['真标题']);
	});

	it('keeps ids in sync for links, code spans, raw HTML and entities', async () => {
		const md = [
			'## 参考 [文档](https://example.com) 与 `code span`',
			'## 按 <kbd>⌘</kbd> 保存',
			'## A &amp; B',
			'## 重复',
			'## 重复'
		].join('\n\n');
		const html = await renderMarkdown(md);
		const toc = extractHeadings(md);

		expect(toc.map((h) => h.id)).toEqual(renderedIds(html));
		expect(toc.map((h) => h.text)).toEqual([
			'参考 文档 与 code span',
			'按 ⌘ 保存',
			'A & B',
			'重复',
			'重复'
		]);
		expect(toc.at(-1)?.id).toBe('重复-1');
	});

	it('collects Setext headings', async () => {
		const md = '副标题\n---\n\n正文\n';
		const html = await renderMarkdown(md);

		expect(extractHeadings(md)).toEqual([{ id: '副标题', text: '副标题', level: 2 }]);
		expect(renderedIds(html)).toEqual(['副标题']);
	});

	it('links each heading back to itself', async () => {
		const html = await renderMarkdown('## 一节');
		expect(html).toContain('class="heading-anchor" href="#一节"');
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
		expect(html).toContain('class="code-block" data-lang="cpp"');
		expect(html).toContain('class="code-pre"');
		expect(html).toContain('class="language-cpp"');
	});

	it('falls back to plain text for unknown languages', async () => {
		const html = await renderMarkdown('```not-a-language\nhello\n```');
		expect(html).toContain('data-lang="text"');
	});

	it('wraps tables so wide ones can scroll', async () => {
		const html = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
		expect(html).toContain('<div class="table-wrap"><table>');
		expect(html).toContain('</table></div>');
	});
});
