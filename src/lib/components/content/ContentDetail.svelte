<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import CommentSection from '$lib/components/comments/CommentSection.svelte';
  import { getDictionary, homePath } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { hasFeature } from '$lib/engine/features';
  import { pageTitle } from '$lib/seo';

  /**
   * Compact detail renderer for short-form content (notes, moments, photos…):
   * title + meta + body + optional comments. No TOC or related list.
   * @type {{
   *   post: import('$lib/content/view').PostView,
   *   lang?: string,
   *   comments?: boolean,
   *   translations?: import('$lib/content/view').TranslationLink[]
   * }}
   */
  let { post, lang = site.defaultLocale, comments = true, translations = [] } = $props();

  const t = $derived(getDictionary(lang));
  const defaultAlt = $derived(translations.find((a) => a.lang === site.defaultLocale));
  const switcherLinks = $derived(
    Object.fromEntries(translations.map((a) => [a.lang, `/${a.url}`]))
  );

  /** @param {string} iso */
  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>{pageTitle(post.title)}</title>
  <meta name="description" content={post.description} />
  <link rel="canonical" href={`${site.url}/${post.url}`} />
  <meta property="og:title" content={post.title} />
  <meta property="og:description" content={post.description} />
  <meta property="og:type" content="article" />
  <meta property="og:url" content={`${site.url}/${post.url}`} />
  <meta property="og:image" content={`${site.url}${lang === site.defaultLocale ? '/' : `/${lang}/`}og/${post.slug}.svg`} />
  {#if translations.length > 1}
    {#each translations as alt}
      <link rel="alternate" hreflang={alt.lang} href={`${site.url}/${alt.url}`} />
    {/each}
    {#if defaultAlt}
      <link rel="alternate" hreflang="x-default" href={`${site.url}/${defaultAlt.url}`} />
    {/if}
  {/if}
</svelte:head>

<LanguageSwitcher links={switcherLinks} />
<PageLogo href={homePath(lang)} />

<main class="compact-page">
  <article>
    <header class="content-head">
      <h1>{post.title}</h1>
      <div class="meta">
        <time datetime={post.occurredAt ?? post.date}>{formatDate(post.occurredAt ?? post.date)}</time>
        {#if post.tags?.length}
          <div class="tags">
            {#each post.tags as tag}
              <span class="pill">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>
    </header>

    <div class="content-body">{@html post.bodyHtml}</div>

    {#if comments && hasFeature('comments')}
      <CommentSection targetType={post.type} targetId={post.id} {lang} />
    {/if}
  </article>
</main>

<style>
  .compact-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 128px clamp(20px, 5vw, 48px) 140px;
  }

  .content-head {
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--color-paper-line);
  }

  .content-head h1 {
    margin: 0 0 12px;
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(1.8rem, 4.5vw, 2.5rem);
    letter-spacing: -0.015em;
    line-height: 1.2;
    color: var(--color-ink);
  }

  .meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-bud);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tags .pill {
    font-size: 0.72rem;
    padding: 3px 9px;
  }

  .content-body {
    font-size: 1.02rem;
    line-height: 1.8;
    color: var(--color-on-surface);
  }

  .content-body :global(p) {
    margin: 0 0 0.9em;
  }

  .content-body :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 2rem auto;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .content-body :global(a) {
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  .content-body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.15em 0.35em;
    border-radius: 4px;
    background: var(--color-surface-container);
  }

  @media (max-width: 640px) {
    .compact-page {
      padding-top: 96px;
    }
  }
</style>
