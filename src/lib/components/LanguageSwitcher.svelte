<script>
  import { page } from '$app/stores';
  import { site } from '$lib/site';
  import { localeFromPath, supportedLanguages } from '$lib/i18n/index.js';

  let { overrideHref = undefined } = $props();

  const currentLang = $derived(localeFromPath($page.url.pathname));
  const others = $derived(site.locales.filter((l) => l.code !== currentLang));

  /**
   * Swap the locale prefix of a path. The default locale lives at the root.
   * @param {string} pathname
   * @param {string} target
   */
  function swapLocale(pathname, target) {
    const current = localeFromPath(pathname);
    let rest = current === site.defaultLocale ? pathname : pathname.slice(`/${current}`.length) || '/';
    if (!rest.startsWith('/')) rest = `/${rest}`;
    return target === site.defaultLocale ? rest : `/${target}${rest === '/' ? '' : rest}`;
  }
</script>

{#if supportedLanguages.length > 1}
  {#each others as loc}
    <a
      href={overrideHref ?? swapLocale($page.url.pathname, loc.code)}
      class="lang-switch"
      data-locale={loc.code}
    >{loc.label}</a>
  {/each}
{/if}

<style>
  .lang-switch {
    position: fixed;
    top: 20px;
    right: 24px;
    z-index: 1000;
    padding: 6px 14px;
    background: var(--color-surface);
    border: 1px solid var(--color-paper-line);
    border-radius: 999px;
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-decoration: none;
    transition: color 0.2s, border-color 0.2s, box-shadow 0.2s;
    backdrop-filter: blur(10px);
    box-shadow: var(--shadow-soft);
  }

  .lang-switch + .lang-switch {
    right: 96px;
  }

  .lang-switch:hover {
    border-color: var(--color-bud);
    color: var(--color-bud);
  }
</style>
