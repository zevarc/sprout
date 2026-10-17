/**
 * Client-side syntax highlighting.
 *
 * Code blocks arrive from the server as escaped plain text with
 * `data-lang`, so the browser does the highlighting: no Worker CPU/memory
 * limits, and every language works. highlight.js is loaded lazily and only
 * when the page actually contains code.
 */

/** @type {Promise<any> | null} */
let hljsPromise = null;

function loadHljs() {
	if (!hljsPromise) {
		hljsPromise = Promise.all([
			import('highlight.js'),
			import('highlight.js/styles/github-dark.css')
		]).then(([mod]) => mod.default ?? mod);
	}
	return hljsPromise;
}

/** Highlights any not-yet-processed code blocks currently in the DOM. */
export function setupHighlight() {
	const blocks = document.querySelectorAll(
		'pre.code-pre[data-lang] > code:not([data-highlighted])'
	);
	if (blocks.length === 0) return;

	loadHljs()
		.then((hljs) => {
			for (const el of blocks) {
				if (!(el instanceof HTMLElement)) continue;
				const lang = el.parentElement?.getAttribute('data-lang') ?? '';
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
}
