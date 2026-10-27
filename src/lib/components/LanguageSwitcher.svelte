<script>
  import { page } from '$app/stores';
  import { site } from '$lib/site';
  import { getDictionary, localeShort, localeFromPath } from '$lib/i18n/index.js';

  /**
   * `links` maps a language code to the URL of *this same piece* in that language.
   * Leave it undefined on pages that exist for every language (lists, fixed pages)
   * and the prefix is swapped. Pass it on a detail page so a translation with a
   * different slug links correctly — and a language with no translation is then
   * not offered at all.
   * @type {{ links?: Record<string, string> }}
   */
  let { links = undefined } = $props();

  const t = $derived(getDictionary(localeFromPath($page.url.pathname)));
  const currentLang = $derived(localeFromPath($page.url.pathname));
  const others = $derived(
    site.locales.filter((l) => l.code !== currentLang && (!links || links[l.code]))
  );

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

{#if others.length > 0}
  <div class="lang-switch-group">
    {#each others as loc}
      <!-- The control shows a compact code; the full language name stays the
           accessible name, so nothing is lost to a screen reader. -->
      <a
        href={links?.[loc.code] ?? swapLocale($page.url.pathname, loc.code)}
        class="lang-switch"
        hreflang={loc.code}
        aria-label={(t.common?.switchLanguage ?? 'Switch to {name}').replace('{name}', loc.label)}
        title={(t.common?.switchLanguage ?? 'Switch to {name}').replace('{name}', loc.label)}
        data-locale={loc.code}
      >
        <svg class="lang-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span class="lang-code" translate="no">{localeShort(loc.code)}</span>
      </a>
    {/each}
  </div>
{/if}

<style>
  /* A flex group, not hardcoded offsets: a third language must not depend on
     guessing how wide its neighbours are. */
  .lang-switch-group {
    position: fixed;
    top: max(20px, env(safe-area-inset-top));
    right: max(24px, env(safe-area-inset-right));
    z-index: 1000;
    display: flex;
    gap: 8px;
  }

  .lang-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 2rem;
    padding: 6px 11px;
    background: var(--color-surface);
    border: 1px solid var(--color-paper-line);
    border-radius: 999px;
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    white-space: nowrap;
    backdrop-filter: blur(10px);
    box-shadow: var(--shadow-soft);
    transition: color 0.2s, border-color 0.2s, box-shadow 0.2s;
  }

  /* 44px touch target without growing the visible pill. */
  .lang-switch::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: inherit;
  }

  .lang-switch:hover {
    border-color: var(--color-bud);
    color: var(--color-bud);
  }

  .lang-switch:focus-visible {
    outline: 2px solid var(--color-bud);
    outline-offset: 2px;
  }

  .lang-icon {
    width: 13px;
    height: 13px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
  }

  @media (prefers-reduced-motion: reduce) {
    .lang-switch {
      transition: none;
    }
  }
</style>
