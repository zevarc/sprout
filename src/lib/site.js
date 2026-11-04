/**
 * Single import point for site configuration.
 * App code should use `import { site } from '$lib/site'`.
 *
 * The file itself belongs to the *instance*, behind the `$site` alias:
 * `src/site/config.js` in this repo (the demo instance), or the consuming
 * app's `src/site/config.js` when this repo is used as an engine package.
 * The engine therefore never owns identity.
 */
export { site } from '$site/config';
