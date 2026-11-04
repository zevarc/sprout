<script>
  /**
   * Instance page overlay for `/blogroll`.
   *
   * This is the default: render the engine's blogroll. Replace the import (and
   * keep the `blogs` / `picks` / `latest` props) to give the page your own
   * visual language — the route and its loader stay in the engine, so an engine
   * upgrade never touches this file.
   */
  import BlogrollPage from '$lib/components/blogroll/BlogrollPage.svelte';

  const props = $props();
</script>

<BlogrollPage {...props} />
