<script>
  import Search from '$lib/components/search/Search.svelte';
  import { page } from '$app/stores';
  import { localeFromPath } from '$lib/i18n/index.js';

  const lang = $derived(localeFromPath($page.url.pathname));
</script>

<Search {lang} />
