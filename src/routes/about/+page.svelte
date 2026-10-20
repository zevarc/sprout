<script>
  import AboutPage from '$lib/components/about/AboutPage.svelte';
  import { page } from '$app/stores';
  import { localeFromPath } from '$lib/i18n/index.js';

  const lang = $derived(localeFromPath($page.url.pathname));
</script>

<AboutPage {lang} />
