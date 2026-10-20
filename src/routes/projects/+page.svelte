<script>
  import ProjectsPage from '$lib/components/projects/ProjectsPage.svelte';

  const { data } = $props();
  const { projects, lang } = $derived(data);
</script>

<ProjectsPage {projects} {lang} />
