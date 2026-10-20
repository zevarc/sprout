<script>
  import ContentListPage from '$lib/components/content/ContentListPage.svelte';

  const { data } = $props();
  const { type, entries, lang } = $derived(data);
</script>

<ContentListPage {type} {entries} {lang} layout={type.listRenderer ?? 'list'} />
