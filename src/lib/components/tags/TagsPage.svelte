<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import PostList from '$lib/components/posts/PostList.svelte';
  import { getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  let {
    lang = site.defaultLocale,
    /** @type {string | null} */ tag = null,
    /** @type {Array<{ tag: string, count: number }>} */ tags = [],
    /** @type {Array<any>} */ posts = []
  } = $props();

  const t = $derived(getDictionary(lang));
  const home = $derived(homePath(lang));
  const basePath = $derived(`/${getLink('tags', lang)}`);

  /** @param {string} name */
  const hrefFor = (name) => `${basePath}/${encodeURIComponent(name)}`;
  const canonical = $derived(tag ? `${site.url}${hrefFor(tag)}` : `${site.url}${basePath}`);

  const jsonLd = $derived({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: tag ? `${t.tags.kicker}: ${tag}` : t.tags.title,
    url: canonical,
    inLanguage: lang,
    isPartOf: { '@id': `${site.url}/#website` }
  });
</script>

<svelte:head>
  <title>{pageTitle(tag ?? t.tags.title)}</title>
  <meta name="description" content={tag ? `${tag} — ${t.tags.subtitle}` : t.tags.subtitle} />
  <link rel="canonical" href={canonical} />
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<LanguageSwitcher />
<PageLogo href={home} />

<main class="tags-page">
  <header class="page-head">
    <p class="kicker">{t.tags.kicker}</p>
    <h1 class="page-title">{tag ?? t.tags.title}</h1>
    <p class="page-sub">
      {#if tag}{posts.length} {t.tags.count}{:else}{t.tags.subtitle}{/if}
    </p>
  </header>

  {#if tag}
    <a class="back" href={basePath}>{t.tags.all}</a>
    {#if posts.length > 0}
      <PostList {posts} readMoreLabel={t.posts.readMore} readTimeLabel={t.posts.readTime} />
    {:else}
      <p class="empty">{t.tags.empty}</p>
    {/if}
  {:else}
    <ul class="tag-cloud">
      {#each tags as item (item.tag)}
        <li>
          <a class="tag-link" href={hrefFor(item.tag)}>
            {item.tag}<span class="n">{item.count}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .tags-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  /* .kicker / .page-title / .page-sub live in main.css */
  .page-head {
    margin-bottom: 48px;
  }

  .back {
    display: inline-block;
    margin-bottom: 24px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  .tag-cloud {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .tag-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--color-bud-pale);
    color: var(--color-bud-deep);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-decoration: none;
  }

  .tag-link:hover {
    background: var(--color-bud-soft);
  }

  .n {
    font-size: 0.72rem;
    color: var(--color-ink-faint);
  }

  .empty {
    color: var(--color-ink-soft);
  }

  @media (max-width: 768px) {
    .tags-page {
      padding-top: 96px;
    }
  }
</style>
