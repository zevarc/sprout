<script>
  import ProjectsPage from '$lib/components/projects/ProjectsPage.svelte';

  const { data } = $props();
</script>

<ProjectsPage lang="zh" projects={data.projects} />
