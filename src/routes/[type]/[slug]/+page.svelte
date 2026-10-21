<script>
  import Post from '$lib/components/posts/Post.svelte';
  import ContentDetail from '$lib/components/content/ContentDetail.svelte';

  const { data } = $props();
  const { post, related, type, translations } = $derived(data);
  const comments = $derived(type?.comments === true);
</script>

{#if type?.detailRenderer === 'compact'}
  <ContentDetail {post} lang={post.lng} {comments} {translations} />
{:else}
  <Post {post} {related} {comments} {translations} />
{/if}
