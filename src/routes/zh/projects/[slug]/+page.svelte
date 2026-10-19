<script>
  import ProjectDetail from '$lib/components/projects/ProjectDetail.svelte';

  const { data } = $props();
</script>

<ProjectDetail project={data.project} bodyHtml={data.bodyHtml} lang="zh" />
