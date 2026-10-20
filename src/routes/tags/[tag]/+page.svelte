<script>
  import TagsPage from '$lib/components/tags/TagsPage.svelte';

  const { data } = $props();
  const { tag, posts, lang } = $derived(data);
</script>

<TagsPage {tag} {posts} {lang} />
