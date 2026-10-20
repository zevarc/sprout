<script>
  import ProjectDetail from '$lib/components/projects/ProjectDetail.svelte';

  const { data } = $props();
  const { project, bodyHtml, lang } = $derived(data);
</script>

<ProjectDetail {project} {bodyHtml} {lang} />
