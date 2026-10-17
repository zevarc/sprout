<script>
  import PostsPage from '$lib/components/posts/PostsPage.svelte';
  const {data } = $props();
  const { posts, notes } = $derived(data);
</script>

<PostsPage {posts} {notes} lang="zh"/>
