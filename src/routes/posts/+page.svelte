<script>
  import PostsPage from '$lib/components/posts/PostsPage.svelte';
  const { data } = $props();
  const { posts, lang } = $derived(data);
</script>

<PostsPage {posts} {lang} />
