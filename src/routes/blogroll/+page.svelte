<script>
  /**
   * `/blogroll` — the route (and its `+page.server.ts` data) belongs to the
   * engine; the rendering belongs to the site. An instance overrides
   * `$site/pages/blogroll.svelte` (see docs/INSTANCE.md); this file never
   * changes.
   */
  import Page from '$site/pages/blogroll.svelte';

  const { data } = $props();
</script>

<Page {...data} />
