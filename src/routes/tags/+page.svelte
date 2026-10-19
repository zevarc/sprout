<script>
  import TagsPage from '$lib/components/tags/TagsPage.svelte';

  const { data } = $props();
</script>

<TagsPage tags={data.tags} />
