import en from './en.js';
import zh from './zh.js';

export const dictionaries = {
  en,
  zh
};

/**
 * @param {string} lang
 */
export function getDictionary(lang) {
  return dictionaries[/** @type {keyof typeof dictionaries} */ (lang)] || dictionaries.en;
}

export const supportedLanguages = ['en', 'zh'];

/**
 * @param {string} path
 * @param {string} [lang]
 */
export function getLink(path, lang='en') {
     return lang === 'en' ? path : `${lang}/${path}`
}

export default { dictionaries, getDictionary, supportedLanguages,getLink };
