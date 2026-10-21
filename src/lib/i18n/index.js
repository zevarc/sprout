import { site } from '$lib/site';
import { i18nFragments } from '$lib/engine/registry';
import en from './en.js';
import zh from './zh.js';

const baseDictionaries = { en, zh };

/**
 * Merge a mod's dictionary fragment over the base dictionary. Plain objects
 * merge recursively; arrays and scalars replace.
 * @param {any} base
 * @param {any} extra
 */
function deepMerge(base, extra) {
  if (base == null || typeof base !== 'object' || Array.isArray(base)) return extra ?? base;
  if (extra == null || typeof extra !== 'object' || Array.isArray(extra)) return extra ?? base;
  /** @type {Record<string, any>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out;
}

/** Base dictionaries with every mod contribution applied. */
/** @type {Record<string, any>} */
const merged = {};
for (const [code, dict] of Object.entries(baseDictionaries)) {
  merged[code] = deepMerge(dict, i18nFragments?.[code] ?? {});
}
// A mod may introduce a locale that has no base dictionary of its own.
for (const [code, fragment] of Object.entries(i18nFragments ?? {})) {
  if (!(code in merged)) merged[code] = fragment;
}

export const dictionaries = merged;
const byLang = /** @type {Record<string, any>} */ (merged);

/**
 * @param {string} [lang]
 */
export function getDictionary(lang = site.defaultLocale) {
  return byLang[lang] ?? byLang[site.defaultLocale] ?? en;
}

/** Languages the site ships, from `site.config.js`. Order is display order; `defaultLocale` is the unprefixed one. */
export const supportedLanguages = site.locales.map((l) => l.code);

const NON_DEFAULT_LOCALES = supportedLanguages.filter((c) => c !== site.defaultLocale);

/**
 * The locale of a URL path: a non-default locale prefix, else the default.
 * @param {string} pathname
 */
export function localeFromPath(pathname) {
  const seg = (pathname ?? '/').split('/')[1];
  return NON_DEFAULT_LOCALES.includes(seg) ? seg : site.defaultLocale;
}

/**
 * Prefixes a path with the locale, unless it is the default one (which lives
 * at the root, so a single-language site needs no prefixes at all).
 * @param {string} path
 * @param {string} [lang]
 */
export function getLink(path, lang = site.defaultLocale) {
  return lang === site.defaultLocale ? path : `${lang}/${path}`;
}

/**
 * The home path for a locale: `/` for the default locale, `/<code>` otherwise.
 * @param {string} [lang]
 */
export function homePath(lang = site.defaultLocale) {
  return lang === site.defaultLocale ? '/' : `/${lang}`;
}

/**
 * Removes a non-default locale prefix from a pathname, yielding the path the
 * root route tree is keyed on (e.g. `/zh/timeline` → `/timeline`).
 * @param {string} pathname
 */
export function stripLocale(pathname) {
  const lang = localeFromPath(pathname);
  if (lang === site.defaultLocale) return pathname;
  const rest = pathname.slice(1 + lang.length);
  return rest.startsWith('/') ? rest : `/${rest}`;
}

export default {
  dictionaries,
  getDictionary,
  supportedLanguages,
  localeFromPath,
  getLink,
  homePath,
  stripLocale
};
