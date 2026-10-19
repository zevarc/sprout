<script>
  import TagsPage from '$lib/components/tags/TagsPage.svelte';

  const { data } = $props();
</script>

<TagsPage lang="zh" tag={data.tag} posts={data.posts} />
