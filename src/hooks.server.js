/**
 * Sets the correct `lang` attribute on the SSR-rendered <html> element,
 * and applies the site-wide security headers.
 *
 * Note: Cloudflare Workers static assets do **not** support a `_headers` file
 * (that is a Pages-only feature), so anything served straight from the asset
 * binding keeps Cloudflare's defaults. Everything dynamic — pages, /media,
 * /api — passes through here.
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

export async function handle({ event, resolve }) {
  const lang = event.url.pathname.startsWith('/zh') ? 'zh' : 'en';

  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('<html lang="en"', `<html lang="${lang}"`),
  });

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  // robots.txt already disallows /admin; the header also survives direct hits.
  if (event.url.pathname.startsWith('/admin')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}
