<script>
  import TagsPage from '$lib/components/tags/TagsPage.svelte';

  const { data } = $props();
  const { tags, lang } = $derived(data);
</script>

<TagsPage {tags} {lang} />
