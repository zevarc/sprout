<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import MomentFeed from '$lib/components/moments/MomentFeed.svelte';
  import { getDictionary } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { data } = $props();
  const { moments } = $derived(data);
  const t = $derived(getDictionary('en'));
</script>

<svelte:head>
  <title>{pageTitle(t.moments.title)}</title>
  <meta name="description" content={t.moments.subtitle} />
  <link rel="canonical" href={`${site.url}/moments`} />
</svelte:head>

<LanguageSwitcher overrideHref="/zh" />
<PageLogo href="/" />

<main class="moments-page">
  <header class="page-head">
    <p class="kicker">Records</p>
    <h1 class="page-title">{t.moments.title}</h1>
    <p class="page-sub">{t.moments.subtitle}</p>
  </header>

  <MomentFeed {moments} lang="en" />
</main>

<style>
  .moments-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  .page-head {
    margin-bottom: 48px;
  }

  .kicker {
    margin: 0 0 14px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--color-bud);
  }

  .page-title {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(2.2rem, 6vw, 3.2rem);
    letter-spacing: -0.015em;
    margin: 0 0 12px;
    color: var(--color-ink);
  }

  .page-sub {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.7;
    color: var(--color-ink-soft);
  }

  @media (max-width: 768px) {
    .moments-page {
      padding-top: 96px;
    }
  }
</style>
