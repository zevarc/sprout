<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import CommentSection from '$lib/components/comments/CommentSection.svelte';
  import { getDictionary } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { data } = $props();
  const { post } = $derived(data);
  const t = $derived(getDictionary('en'));

  const images = $derived(Array.isArray(post.extra?.images) ? post.extra.images : []);

  /**
   * @param {string} iso
   */
  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>{pageTitle(t.moments.title)}</title>
  <link rel="canonical" href={`${site.url}/${post.url}`} />
</svelte:head>

<LanguageSwitcher overrideHref="/zh" />
<PageLogo href="/moments" />

<main class="moment-page">
  <article>
    <time class="moment-date" datetime={post.date}>{formatDate(post.date)}</time>
    <div class="moment-body">{@html post.bodyHtml}</div>
    {#if images.length > 0}
      <div class="moment-media">
        {#each images as src}
          <img src={src} alt="" loading="lazy" decoding="async" />
        {/each}
      </div>
    {/if}

    {#if site.features.comments}
      <CommentSection targetType={post.type} targetId={post.id} lang="en" />
    {/if}
  </article>
</main>

<style>
  .moment-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 128px clamp(20px, 5vw, 48px) 140px;
  }

  .moment-date {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-bud);
  }

  .moment-body {
    margin-top: 14px;
    font-size: 1.05rem;
    line-height: 1.8;
    color: var(--color-on-surface);
  }

  .moment-body :global(p) {
    margin: 0 0 0.8em;
  }

  .moment-media {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .moment-media img {
    width: 100%;
    border-radius: 12px;
    border: 1px solid var(--border-color);
  }
</style>
