<script>
  /**
   * `+error.svelte` — the shell for every `error(4xx/5xx)` and for any URL that
   * matches no route. Routes stay in the engine, so this lives here rather than
   * per instance; the copy is overridable through `mods[].i18n` like any other
   * dictionary fragment.
   */
  import { page } from '$app/stores';
  import ErrorPage from '$lib/components/error/ErrorPage.svelte';
  import { localeFromPath } from '$lib/i18n/index.js';

  const status = $derived($page.status);
  const path = $derived($page.url.pathname);
  // `reroute` leaves `url.pathname` untouched, so a `/zh/…` miss still reads as
  // Chinese here — the same rule every loader uses.
  const lang = $derived(localeFromPath($page.url.pathname));
</script>

<ErrorPage {status} {path} {lang} />
