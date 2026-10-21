/**
 * Sets the correct `lang` attribute on the SSR-rendered <html> element, guards
 * the configured private routes, and applies the site-wide security headers.
 *
 * Note: Cloudflare Workers static assets do **not** support a `_headers` file
 * (that is a Pages-only feature), so anything served straight from the asset
 * binding keeps Cloudflare's defaults. Everything dynamic — pages, /media,
 * /api — passes through here.
 */

import { privateRoutes } from '$lib/engine/registry';
import { listTypes } from '$lib/content/registry';
import { hasFeature } from '$lib/engine/features';
import { assertValidConfig } from '$lib/engine/validate';
import { themeCss, PRESETS } from '$lib/engine/theme';
import { dirFor, localeFromPath, stripLocale } from '$lib/i18n';
import { getSession } from '$lib/server/auth';

// Fail fast on a misconfigured assembly (bad type route, unknown feature, …).
assertValidConfig();

// Resolved once per boot; injected into <head> so theming is SSR (no flash).
const THEME_CSS = themeCss();

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

/**
 * Path prefixes that require an owner/member session: every non-public content
 * type (from the registry) plus any extra routes listed in the site config.
 */
function privatePrefixes() {
  const fromTypes = listTypes().filter((t) => !t.public).map((t) => t.route);
  // Nothing built in: a site that wants a members-only timeline (or any other
  // extra guarded path) lists it in `privateRoutes`.
  return [...new Set([...(privateRoutes ?? []), ...fromTypes])];
}

/**
 * True when `pathname` is (or is under) one of the configured private routes.
 * @param {string} pathname
 */
function isPrivatePath(pathname) {
  return privatePrefixes().some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function handle({ event, resolve }) {
  const { pathname } = event.url;
  // Route matching is locale-stripped via `reroute`, but `event.url` keeps the
  // real path — so guards must look at the unprefixed form.
  const bare = stripLocale(pathname);

  // Private area: require an owner/member session before anything renders.
  if (isPrivatePath(bare)) {
    const db = event.platform?.env?.DB;
    const session = db ? await getSession(event, db) : null;
    const allowed = session?.role === 'owner' || session?.role === 'member';
    if (!allowed) {
      const next = encodeURIComponent(pathname + event.url.search);
      return new Response(null, { status: 302, headers: { location: `/login?next=${next}` } });
    }
  }

  const lang = localeFromPath(pathname);

  // `?theme=<preset>` previews another theme for this request only (no config change).
  const previewName = event.url.searchParams.get('theme');
  const css = previewName && PRESETS[previewName] ? themeCss(previewName, {}) : THEME_CSS;

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      let out = html.replace(
        '<html lang="en"',
        `<html lang="${lang}" dir="${dirFor(lang)}"`
      );
      if (css) {
        out = out.replace('</head>', `<style data-sprout-theme>${css}</style></head>`);
      }
      return out;
    },
  });

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }

  // robots.txt already disallows /admin; the header also survives direct hits.
  if (bare.startsWith('/admin') || isPrivatePath(bare)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}
