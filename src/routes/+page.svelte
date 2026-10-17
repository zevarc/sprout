<script>
  import HomePage from '$lib/components/home/HomePage.svelte';

  const { data } = $props();
</script>

<HomePage lang="en" posts={data.posts} projects={data.projects} />
