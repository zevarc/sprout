<script>
  import PageLogo from '$lib/components/PageLogo.svelte';
  import Timeline from '$lib/components/timeline/Timeline.svelte';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { data } = $props();
  const { entries, authors, lang } = $derived(data);
</script>

<svelte:head>
  <title>{pageTitle('Timeline')}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<PageLogo href="/" />

<main class="timeline-page">
  <header class="page-head">
    <p class="kicker">{site.name}</p>
    <h1 class="page-title">Timeline</h1>
    <p class="page-sub">Everything in one feed, latest first.</p>
  </header>

  <Timeline {entries} {authors} {lang} />
</main>

<style>
  .timeline-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  .page-head {
    margin-bottom: 40px;
  }
</style>
