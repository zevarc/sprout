/**
 * Client-side syntax highlighting.
 *
 * Code blocks arrive from the server as escaped plain text with
 * `data-lang`, so the browser does the highlighting: no Worker CPU/memory
 * limits, and every language works. highlight.js is loaded lazily and only
 * when the page actually contains code.
 *
 * Only the highlighter *core* plus the grammars the renderer can actually emit
 * are imported. `import('highlight.js')` registers ~190 languages (several
 * hundred KB) and every article with one C++ snippet would pay for all of them;
 * the registry here mirrors `SUPPORTED` in `$lib/server/render`.
 *
 * Only the highlighter itself is imported — the colour palette lives in our
 * own tokens (`src/styles/main.css`), not in a vendor stylesheet.
 */

/**
 * Canonical grammar ids, i.e. exactly what `normalizeLang()` writes into
 * `data-lang`. `text` / `plaintext` are deliberately absent: they render as
 * escaped plain text and need no grammar.
 */
const GRAMMARS = {
	bash: () => import('highlight.js/lib/languages/bash'),
	c: () => import('highlight.js/lib/languages/c'),
	cmake: () => import('highlight.js/lib/languages/cmake'),
	cpp: () => import('highlight.js/lib/languages/cpp'),
	csharp: () => import('highlight.js/lib/languages/csharp'),
	css: () => import('highlight.js/lib/languages/css'),
	diff: () => import('highlight.js/lib/languages/diff'),
	go: () => import('highlight.js/lib/languages/go'),
	gradle: () => import('highlight.js/lib/languages/gradle'),
	groovy: () => import('highlight.js/lib/languages/groovy'),
	ini: () => import('highlight.js/lib/languages/ini'),
	java: () => import('highlight.js/lib/languages/java'),
	javascript: () => import('highlight.js/lib/languages/javascript'),
	json: () => import('highlight.js/lib/languages/json'),
	kotlin: () => import('highlight.js/lib/languages/kotlin'),
	makefile: () => import('highlight.js/lib/languages/makefile'),
	markdown: () => import('highlight.js/lib/languages/markdown'),
	objectivec: () => import('highlight.js/lib/languages/objectivec'),
	perl: () => import('highlight.js/lib/languages/perl'),
	php: () => import('highlight.js/lib/languages/php'),
	python: () => import('highlight.js/lib/languages/python'),
	ruby: () => import('highlight.js/lib/languages/ruby'),
	rust: () => import('highlight.js/lib/languages/rust'),
	scss: () => import('highlight.js/lib/languages/scss'),
	sql: () => import('highlight.js/lib/languages/sql'),
	swift: () => import('highlight.js/lib/languages/swift'),
	typescript: () => import('highlight.js/lib/languages/typescript'),
	xml: () => import('highlight.js/lib/languages/xml'),
	yaml: () => import('highlight.js/lib/languages/yaml')
};

/** @typedef {keyof typeof GRAMMARS} GrammarName */

/** @type {Promise<import('highlight.js').HLJSApi> | null} */
let hljsPromise = null;

/** Core + every grammar in one round trip; grammars register into the core. */
function loadHljs() {
	if (!hljsPromise) {
		hljsPromise = (async () => {
			const [{ default: hljs }, grammars] = await Promise.all([
				import('highlight.js/lib/core'),
				Promise.all(
					Object.entries(GRAMMARS).map(
						async ([name, load]) => /** @type {const} */ ([name, (await load()).default])
					)
				)
			]);
			for (const [name, grammar] of grammars) {
				hljs.registerLanguage(name, grammar);
			}
			return hljs;
		})();
	}
	return hljsPromise;
}

/** Highlights any not-yet-processed code blocks currently in the DOM. */
export function setupHighlight() {
	const blocks = document.querySelectorAll('pre.code-pre > code:not([data-highlighted])');
	if (blocks.length === 0) return;

	loadHljs()
		.then((hljs) => {
			for (const el of blocks) {
				if (!(el instanceof HTMLElement)) continue;
				const lang = el.closest('.code-block')?.getAttribute('data-lang') ?? '';
				el.setAttribute('data-highlighted', '1');
				try {
					if (lang && lang !== 'text' && hljs.getLanguage(lang)) {
						el.innerHTML = hljs.highlight(el.textContent ?? '', {
							language: lang,
							ignoreIllegals: true
						}).value;
					}
					el.classList.add('hljs');
				} catch {
					// leave the escaped plain text in place
					el.classList.add('hljs');
				}
			}
		})
		.catch(() => {
			/* highlighter unavailable — code stays readable as plain text */
		});

	// The element count only grows (new blocks arrive on client-side navigation),
	// so a single pass over the current DOM is enough; `setupHighlight()` is
	// called again after every navigation.
}
