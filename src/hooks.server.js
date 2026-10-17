/**
 * Sets the correct `lang` attribute on the SSR-rendered <html> element
 * so that Pagefind can group search results by language (en / zh).
 */
export function handle({ event, resolve }) {
  const lang = event.url.pathname.startsWith('/zh') ? 'zh' : 'en';
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="en"', `<html lang="${lang}"`),
  });
}
