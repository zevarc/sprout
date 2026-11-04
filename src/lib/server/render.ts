/**
 * Markdown → HTML rendering at write time.
 *
 * Deliberately does NOT run a syntax highlighter: Shiki's engines either blow a
 * Worker isolate's resource limits (JS regex engine on C++/CMake) or fail to
 * initialise (WASM engine). Instead code blocks are emitted as escaped text
 * with a `data-lang` marker, and highlighted in the browser — see
 * `$lib/highlight.js`. This keeps publishing fast, cheap and unbounded in
 * language/size, and keeps the Worker bundle small.
 *
 * Heading ids come from the same instance that renders the body, and
 * `extractHeadings` reads them back out of the token stream, so the table of
 * contents can never point at an id that does not exist (fenced code, inline
 * HTML, entities and Setext headings are the parser's problem, not a regex's).
 */

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { slugify, type TocItem } from '$lib/reading';
import { site } from '$lib/site';

type Md = InstanceType<typeof MarkdownIt>;

/** Aliases → canonical id understood by the client highlighter. */
const ALIASES: Record<string, string> = {
	js: 'javascript',
	ts: 'typescript',
	sh: 'bash',
	zsh: 'bash',
	console: 'bash',
	shell: 'bash',
	py: 'python',
	'c++': 'cpp',
	'c/c++': 'cpp',
	// No dedicated grammar in the client highlighter — render as markup.
	jade: 'xml',
	svelte: 'xml',
	astro: 'xml'
};

const SUPPORTED = new Set([
	'bash',
	'c',
	'cpp',
	'csharp',
	'cmake',
	'css',
	'diff',
	'go',
	'gradle',
	'groovy',
	'ini',
	'java',
	'javascript',
	'json',
	'kotlin',
	'makefile',
	'markdown',
	'objectivec',
	'perl',
	'php',
	'plaintext',
	'python',
	'ruby',
	'rust',
	'scss',
	'sql',
	'swift',
	'text',
	'typescript',
	'xml',
	'yaml'
]);

/**
 * `==highlight==` → `<mark>`.
 *
 * Deliberately a local rule instead of a plugin: every instance mirrors the
 * engine's runtime dependencies in its own package.json, so a new dependency
 * would mean touching every site's lockfile for 30 lines of code. Nested inline
 * markup inside the highlight still parses (the content is tokenized).
 */
function markRule(state: any, silent: boolean): boolean {
	const start = state.pos;
	const max = state.posMax;
	if (start + 4 > max) return false;
	if (state.src.charCodeAt(start) !== 0x3d || state.src.charCodeAt(start + 1) !== 0x3d) return false;

	let end = start + 2;
	while (end < max - 1) {
		if (state.src.charCodeAt(end) === 0x3d && state.src.charCodeAt(end + 1) === 0x3d) break;
		end++;
	}
	if (end >= max - 1 || end === start + 2) return false;

	if (!silent) {
		state.push('mark_open', 'mark', 1);
		const prevMax = state.posMax;
		state.pos = start + 2;
		state.posMax = end;
		state.md.inline.tokenize(state);
		state.posMax = prevMax;
		state.push('mark_close', 'mark', -1);
	}

	state.pos = end + 2;
	return true;
}

/** Host of the site itself; links to it stay in the same tab. */
const SITE_HOST = (() => {
	try {
		return new URL(site.url).host;
	} catch {
		return '';
	}
})();

function normalizeLang(info: string): string {
	const name = info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
	const canonical = ALIASES[name] ?? name;
	return SUPPORTED.has(canonical) ? canonical : 'text';
}

/** Built once per isolate; shared by rendering and heading extraction. */
let renderers: { trusted: Md; safe: Md } | null = null;

function instances(): { trusted: Md; safe: Md } {
	if (!renderers) renderers = build();
	return renderers;
}

function build(): { trusted: Md; safe: Md } {
	const make = (allowHtml: boolean): Md => {
		const md = new MarkdownIt({
			html: allowHtml,
			linkify: true,
			breaks: false,
			typographer: false
		});

		md.inline.ruler.before('emphasis', 'sprout_mark', markRule);

		// Outbound links open in a new tab and carry a marker in the CSS; links to
		// the site itself (or in-page anchors) behave exactly as before.
		const renderLinkOpen =
			md.renderer.rules.link_open ??
			((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
		md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
			const rawHref = tokens[idx].attrGet('href');
			const href = typeof rawHref === 'string' ? rawHref : '';
			if (/^https?:\/\//i.test(href)) {
				let external = true;
				try {
					external = new URL(href).host !== SITE_HOST;
				} catch {
					/* unparseable but absolute: treat as external */
				}
				if (external) {
					tokens[idx].attrJoin('class', 'external');
					tokens[idx].attrSet('target', '_blank');
					tokens[idx].attrSet('rel', 'noopener noreferrer');
				}
			}
			return renderLinkOpen(tokens, idx, options, env, self);
		};

		md.use(anchor, {
			slugify,
			uniqueSlugStartIndex: 1,
			tabIndex: false,
			// A permalink symbol next to the heading: lets readers link to a section
			// from the rendered page, not only from the TOC. `ariaHidden` keeps the
			// symbol out of the accessible heading text and out of the TOC labels.
			permalink: anchor.permalink.ariaHidden({
				symbol: '#',
				class: 'heading-anchor',
				space: false,
				placement: 'after'
			})
		});

		// Content images sit below the title/header, so defer them: no layout
		// change, just fewer bytes fetched on first paint.
		const defaultImage = md.renderer.rules.image;
		if (defaultImage) {
			md.renderer.rules.image = (tokens, idx, options, env, self) => {
				tokens[idx].attrSet('loading', 'lazy');
				tokens[idx].attrSet('decoding', 'async');
				return defaultImage(tokens, idx, options, env, self);
			};
		}

		md.renderer.rules.fence = (tokens, idx) => {
			const token = tokens[idx];
			const lang = normalizeLang(token.info ?? '');
			const escaped = md.utils.escapeHtml(token.content);
			// Icon-only copy button: language-neutral (no "Copy"/"复制" flash before
			// the client relabels it) and the label lives in `aria-label`/`title`.
			return (
				`<div class="code-block" data-lang="${lang}">` +
				`<button type="button" class="code-copy" aria-label="Copy code" title="Copy">` +
				`<svg class="icon-copy" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 9h9v9H9z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 15H4V4h11v2"/></svg>` +
				`<svg class="icon-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m4 12 5.5 5.5L20 7"/></svg>` +
				`</button>` +
				`<pre class="code-pre"><code class="language-${lang}">${escaped}</code></pre>` +
				`</div>`
			);
		};

		// Tables scroll inside their own box instead of stretching the article.
		md.renderer.rules.table_open = () => '<div class="table-wrap"><table>';
		md.renderer.rules.table_close = () => '</table></div>';

		return md;
	};

	return { trusted: make(true), safe: make(false) };
}

/** Renders trusted author markdown (raw HTML allowed). */
export async function renderMarkdown(source: string): Promise<string> {
	return instances().trusted.render(source);
}

/** Renders untrusted user content (raw HTML escaped) — e.g. comments. */
export async function renderComment(source: string): Promise<string> {
	return instances().safe.render(source);
}

/**
 * Table of contents (h2–h4) for raw markdown.
 *
 * Reads the ids the renderer actually emits, so TOC anchors and body anchors are
 * the same thing by construction: `## \`foo\``, headings containing links, raw
 * HTML or entities, and headings that only exist inside code fences all come out
 * right. Duplicate headings keep the renderer's `-1`, `-2` suffixes.
 */
export function extractHeadings(source: string): TocItem[] {
	const tokens = instances().trusted.parse(source, {});
	const headings: TocItem[] = [];

	for (let i = 0; i < tokens.length; i++) {
		const open = tokens[i];
		if (open.type !== 'heading_open') continue;
		const level = Number(open.tag.slice(1));
		if (level < 2 || level > 4) continue;
		const inline = tokens[i + 1];
		if (!inline || inline.type !== 'inline') continue;
		// Same set of inline tokens markdown-it-anchor feeds to `slugify`: text and
		// code spans, so the label matches what a reader sees (and what the id was
		// derived from). Permalink symbols are `html_inline` and drop out here.
		const text = (inline.children ?? [])
			.filter((child) => child.type === 'text' || child.type === 'code_inline')
			.map((child) => child.content)
			.join('')
			.trim();
		if (!text) continue;
		const id = open.attrGet('id');
		headings.push({ id: typeof id === 'string' ? id : slugify(text), text, level });
	}

	return headings;
}
