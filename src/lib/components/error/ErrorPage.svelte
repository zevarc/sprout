<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import BrandMark from '$lib/components/visuals/BrandMark.svelte';
  import Arc from '$lib/components/visuals/Arc.svelte';
  import { publicListTypes } from '$lib/content/registry';
  import { getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { pageTitle } from '$lib/seo';
  import { site } from '$lib/site';
  import { statusCopy } from './copy.js';

  /**
   * @type {{ status?: number, path?: string, lang?: string }}
   */
  let { status = 500, path = '/', lang = site.defaultLocale } = $props();

  const t = $derived(getDictionary(lang));
  const copy = $derived(t.error);
  const bucket = $derived(statusCopy(status));
  const home = $derived(homePath(lang));
  const searchPath = $derived(`/${getLink('search', lang)}`);

  /**
   * The "read the latest" exit points at whatever this site publishes first
   * (a site without a single-segment list route gets no third link rather than
   * a dead one).
   */
  const latestType = $derived(publicListTypes()[0]);
  const latestPath = $derived(
    latestType ? `/${getLink(latestType.route.replace(/^\//, ''), lang)}` : null
  );

  // `HTTP 404` — the code is the data, the sentence is the headline.
  const code = $derived(copy.code.replace('{status}', String(status)));
</script>

<svelte:head>
  <title>{pageTitle(`${status} · ${copy.title[bucket]}`)}</title>
  <!-- An error page is never a search result: the URL may be a typo, a revoked
       link or a private path, and indexing it would publish that guess. -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<LanguageSwitcher />
<PageLogo href={home} />

<main class="error-page">
  <div class="watermark" aria-hidden="true">
    <BrandMark size={320} />
  </div>

  <div class="error-copy">
    <p class="kicker">{copy.kicker}</p>
    <p class="code">
      <span>{code}</span>
      <span class="code-sep" aria-hidden="true">·</span>
      <span class="code-path">{path}</span>
    </p>
    <h1 class="page-title">{copy.title[bucket]}</h1>
    <p class="page-sub">{copy.body[bucket]}</p>

    <div class="actions">
      <a class="action-primary" href={home}>{copy.home}</a>
      <span class="action-links">
        <a href={searchPath}>{copy.search}</a>
        {#if latestPath}
          <span class="action-dot" aria-hidden="true">·</span>
          <a href={latestPath}>{copy.latest}</a>
        {/if}
      </span>
    </div>
  </div>

  <div class="arc-wrap">
    <Arc size={96} />
  </div>
</main>

<style>
  /* Centred, unlike every other page: there is no content to align — the empty
     middle is the message. The brand watermark and the hero do the same. */
  .error-page {
    position: relative;
    min-height: 100vh;
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 36px;
    padding: 120px clamp(20px, 5vw, 48px) 96px;
    text-align: center;
  }

  /* Sized like the home hero's watermark and just as faint: at 320px it read
     as a sticker parked behind the headline instead of paper texture. */
  .watermark {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    color: var(--color-bud);
    opacity: 0.06;
    animation: watermark-drift 9s ease-in-out infinite;
  }

  /* BrandMark sizes itself with an inline `width`, which wins over a plain
     class rule — hence `!important`, and hence the note. */
  .watermark :global(svg) {
    width: min(92vw, 760px) !important;
    height: auto !important;
  }

  .error-copy {
    position: relative;
    max-width: 34rem;
  }

  /* The record line: mono scale + a path that must not be upper-cased (URLs
     are case-sensitive), so the label keeps its case and only the spacing is
     tuned. */
  .code {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 10px;
    margin: 0 0 18px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    color: var(--color-bud-deep);
  }

  .code-sep {
    color: var(--color-bud-soft);
  }

  .code-path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.02em;
    color: var(--color-ink-faint);
  }

  .page-sub {
    margin: 16px auto 0;
    max-width: min(30rem, 100%);
    text-wrap: balance;
  }

  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    margin-top: 34px;
  }

  .action-primary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 22px;
    border-radius: var(--radius-pill);
    background-color: var(--color-action-bg);
    color: var(--color-action-ink);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    letter-spacing: 0.02em;
    transition: background-color 0.2s, transform 0.2s;
  }

  .action-primary:hover {
    background-color: var(--color-action-bg-hover);
    color: var(--color-action-ink);
  }

  .action-primary:active {
    background-color: var(--color-action-bg-active);
    transform: scale(0.98);
  }

  .action-links {
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-ink-faint);
  }

  .action-links a {
    min-height: 24px;
    border-bottom: 1px dashed var(--color-bud-soft);
    transition: color 0.2s, border-color 0.2s, background-color 0.2s;
  }

  .action-links a:hover {
    color: var(--color-bud-deep);
    border-bottom-color: var(--color-bud-deep);
    background-color: var(--color-press-tint);
  }

  .action-dot {
    color: var(--color-bud-soft);
  }

  /* Arc paints with currentColor, so the colour is set on the wrapper: a
     class handed to a child component is not selectable from this scope. */
  .arc-wrap {
    position: relative;
    color: var(--color-bud-soft);
  }

  @keyframes watermark-drift {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-12px);
    }
  }

  @media (max-width: 768px) {
    .error-page {
      padding-top: 96px;
    }

    /* Narrow screens have no spare paper around the copy, so the mark has to
       retreat further or it competes with the headline. */
    .watermark {
      opacity: 0.045;
    }

    .watermark :global(svg) {
      width: 132vw !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .watermark {
      animation: none;
    }

    .action-primary,
    .action-links a {
      transition: none;
    }
  }
</style>
