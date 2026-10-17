<script>
import Post from '$lib/components/posts/Post.svelte';
    const { data } = $props();
    const { post, related } = $derived(data);
</script>

<Post {post} {related} />