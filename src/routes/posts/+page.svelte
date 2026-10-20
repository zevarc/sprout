<script>
  import PostsPage from '$lib/components/posts/PostsPage.svelte';
  const { data } = $props();
  const { posts, notes, lang } = $derived(data);
</script>

<PostsPage {posts} {notes} {lang} />
