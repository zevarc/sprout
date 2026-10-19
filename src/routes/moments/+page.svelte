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

  /* .kicker / .page-title / .page-sub live in main.css */
  .page-head {
    margin-bottom: 48px;
  }

  .page-title {
    margin-bottom: 12px;
  }

  @media (max-width: 768px) {
    .moments-page {
      padding-top: 96px;
    }
  }
</style>
