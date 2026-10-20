<script>
  import HomePage from '$lib/components/home/HomePage.svelte';

  const { data } = $props();
  const { sections, lang } = $derived(data);
</script>

<HomePage {sections} {lang} />
