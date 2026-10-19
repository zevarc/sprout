<script>
  import TagsPage from '$lib/components/tags/TagsPage.svelte';

  const { data } = $props();
</script>

<TagsPage tag={data.tag} posts={data.posts} />
