<script>
  import HomePage from '$lib/components/home/HomePage.svelte';

  const { data } = $props();
</script>

<HomePage lang="zh" posts={data.posts} projects={data.projects} />
