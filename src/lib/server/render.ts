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
 * Heading ids must stay identical to `$lib/reading.ts` so TOC anchors match.
 */

import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { slugify } from '$lib/reading';

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

function normalizeLang(info: string): string {
	const name = info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
	const canonical = ALIASES[name] ?? name;
	return SUPPORTED.has(canonical) ? canonical : 'text';
}

let mdPromise: Promise<{ trusted: Md; safe: Md }> | null = null;

function build(): { trusted: Md; safe: Md } {
	const make = (allowHtml: boolean): Md => {
		const md = new MarkdownIt({
			html: allowHtml,
			linkify: true,
			breaks: false,
			typographer: false
		});

		md.use(anchor, { slugify, uniqueSlugStartIndex: 1, tabIndex: false });

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
			return (
				`<div class="code-block">` +
				`<button type="button" class="code-copy" aria-label="Copy code">Copy</button>` +
				`<pre class="code-pre" data-lang="${lang}"><code class="language-${lang}">${escaped}</code></pre>` +
				`</div>`
			);
		};

		return md;
	};

	return { trusted: make(true), safe: make(false) };
}

async function getRenderers() {
	if (!mdPromise) mdPromise = Promise.resolve(build());
	return mdPromise;
}

/** Renders trusted author markdown (raw HTML allowed). */
export async function renderMarkdown(source: string): Promise<string> {
	const { trusted } = await getRenderers();
	return trusted.render(source);
}

/** Renders untrusted user content (raw HTML escaped) — e.g. comments. */
export async function renderComment(source: string): Promise<string> {
	const { safe } = await getRenderers();
	return safe.render(source);
}
