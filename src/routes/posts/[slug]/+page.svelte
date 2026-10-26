<script>
import Post from '$lib/components/posts/Post.svelte';
import { getContentType } from '$lib/content/registry';
    const { data } = $props();
    const { post, related, translations } = $derived(data);
    const comments = $derived(getContentType('post')?.comments ?? false);
</script>

<Post {post} {related} {comments} {translations} />