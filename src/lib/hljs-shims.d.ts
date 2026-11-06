// Type shims for highlight.js' subpath entries.
//
// The package only publishes types for its default entry (`highlight.js`),
// while the client only imports the core plus individual grammars — importing
// the default entry would pull in ~190 languages (see `$lib/highlight`).

declare module 'highlight.js/lib/core' {
	import type { HLJSApi } from 'highlight.js';
	const hljs: HLJSApi;
	export default hljs;
}

declare module 'highlight.js/lib/languages/*' {
	import type { LanguageFn } from 'highlight.js';
	const grammar: LanguageFn;
	export default grammar;
}
