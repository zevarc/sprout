/**
 * Search tokenization for FTS5 (portable, no runtime segmenter needed).
 *
 * CJK text is split into overlapping bigrams so 2-character words like `构建`
 * are indexed and matchable — the plain `unicode61` tokenizer would treat a
 * whole CJK run as one token, and `trigram` would reject queries under 3 chars.
 * Latin words are lowercased as-is.
 */

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const LATIN = /[a-zA-Z0-9]/;

/** Returns the space-separated token stream used for indexing and querying. */
export function tokenize(text: string): string {
	const tokens: string[] = [];
	let i = 0;
	const n = text.length;

	while (i < n) {
		const ch = text[i];

		if (CJK.test(ch)) {
			let j = i;
			while (j < n && CJK.test(text[j])) j++;
			const run = text.slice(i, j);
			if (run.length === 1) {
				tokens.push(run);
			} else {
				for (let k = 0; k + 2 <= run.length; k++) tokens.push(run.slice(k, k + 2));
			}
			i = j;
			continue;
		}

		if (LATIN.test(ch)) {
			let j = i;
			while (j < n && LATIN.test(text[j])) j++;
			tokens.push(text.slice(i, j).toLowerCase());
			i = j;
			continue;
		}

		i++;
	}

	return tokens.join(' ');
}

/** Normalizes a node's searchable text into the FTS column form. */
export function buildSearchText(parts: (string | null | undefined)[]): string {
	return tokenize(parts.filter(Boolean).join('\n'));
}

/** Builds an FTS5 MATCH expression for a raw user query (AND of tokens). */
export function toMatchExpression(rawQuery: string): string {
	const tokens = tokenize(rawQuery).split(' ').filter(Boolean);
	if (tokens.length === 0) return '';
	return tokens.map((t) => `"${t.replace(/"/g, '""')}"`).join(' AND ');
}
