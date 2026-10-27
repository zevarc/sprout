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
 * Compact label for a locale: the `short` declared in `site.locales`, else the
 * uppercased code. Used where the full name would crowd the control (a button
 * shows `EN` / `中`, while the accessible name keeps the full label).
 * @param {string} code
 */
export function localeShort(code) {
  const locale = site.locales.find((l) => l.code === code);
  return locale?.short ?? code.toUpperCase();
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

/**
 * Locale metadata from `site.locales` (falls back to the default locale).
 * @param {string} [lang]
 */
export function localeMeta(lang = site.defaultLocale) {
  return (
    site.locales.find((l) => l.code === lang) ??
    site.locales.find((l) => l.code === site.defaultLocale)
  );
}

/**
 * Writing direction implied by locale metadata: only an explicit `dir: 'rtl'`
 * switches away from left-to-right.
 * @param {{ dir?: string } | undefined} meta
 */
export function dirOf(meta) {
  return meta?.dir === 'rtl' ? 'rtl' : 'ltr';
}

/**
 * Writing direction for a locale.
 * @param {string} [lang]
 */
export function dirFor(lang = site.defaultLocale) {
  return dirOf(localeMeta(lang));
}

/** Terse, unambiguous numeric date: `YYYY.MM.DD`. */
/** @type {Intl.DateTimeFormatOptions} */
const DATE_PARTS = { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' };

/**
 * Formats an ISO timestamp for one locale.
 *
 * By default this is the terse `YYYY.MM.DD` the site has always used. A locale
 * may instead declare `intl` (a BCP-47 tag) and/or `dateFormat` (Intl options)
 * in `site.locales`, and `Intl` then renders that convention — so no locale
 * table lives in the components.
 * @param {string} iso
 * @param {{ code?: string, intl?: string, dateFormat?: Intl.DateTimeFormatOptions } | undefined} meta
 */
export function formatDateFor(iso, meta) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return typeof iso === 'string' ? iso.slice(0, 10) : '';
  const locale = meta?.intl ?? meta?.code ?? site.defaultLocale;
  try {
    if (meta?.dateFormat) {
      return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...meta.dateFormat }).format(date);
    }
    const parts = new Intl.DateTimeFormat('en-US', DATE_PARTS).formatToParts(date);
    /** @param {string} type */
    const part = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return `${part('year')}.${part('month')}.${part('day')}`;
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * @param {string} iso
 * @param {string} [lang]
 */
export function formatDate(iso, lang = site.defaultLocale) {
  return formatDateFor(iso, localeMeta(lang));
}

/** Year + month, terse by default (`YYYY.MM`) — used for timeline headings. */
/** @type {Intl.DateTimeFormatOptions} */
const MONTH_PARTS = { year: 'numeric', month: '2-digit', timeZone: 'UTC' };

/**
 * @param {string} iso
 * @param {{ code?: string, intl?: string, dateFormat?: Intl.DateTimeFormatOptions } | undefined} meta
 */
export function formatMonthFor(iso, meta) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return typeof iso === 'string' ? iso.slice(0, 7) : '';
  const locale = meta?.intl ?? meta?.code ?? site.defaultLocale;
  try {
    if (meta?.dateFormat) {
      return new Intl.DateTimeFormat(locale, {
        timeZone: 'UTC',
        ...meta.dateFormat,
        day: undefined
      }).format(date);
    }
    const parts = new Intl.DateTimeFormat('en-US', MONTH_PARTS).formatToParts(date);
    /** @param {string} type */
    const part = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return `${part('year')}.${part('month')}`;
  } catch {
    return iso.slice(0, 7);
  }
}

/**
 * @param {string} iso
 * @param {string} [lang]
 */
export function formatMonth(iso, lang = site.defaultLocale) {
  return formatMonthFor(iso, localeMeta(lang));
}

export default {
  dictionaries,
  getDictionary,
  supportedLanguages,
  localeFromPath,
  getLink,
  homePath,
  stripLocale,
  localeMeta,
  dirOf,
  dirFor,
  formatDate,
  formatDateFor,
  formatMonth,
  formatMonthFor
};
