<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import PostFrame from './PostFrame.svelte';
  import { getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { lang = site.defaultLocale, posts, notes } = $props();

  let t = $derived(getDictionary(lang));
  const home = $derived(homePath(lang));
</script>

<svelte:head>
  <title>{pageTitle(t.seo.posts.label)}</title>
  <meta name="description" content={t.seo.posts.description} />
  <link rel="canonical" href={`${site.url}/${getLink('posts', lang)}`} />
  {#each site.locales as loc}
    <link rel="alternate" hreflang={loc.code} href={`${site.url}/${getLink('posts', loc.code)}`} />
  {/each}
  {#if site.locales.length > 1}<link rel="alternate" hreflang="x-default" href={`${site.url}/${getLink('posts', site.defaultLocale)}`} />{/if}
</svelte:head>

<LanguageSwitcher />
<PageLogo href={home} />

<main class="posts-page">
  <header class="page-head">
    <p class="kicker">{t.nav.posts}</p>
    <h1 class="page-title">{t.posts.title}</h1>
    <p class="page-sub">{t.posts.subtitle}</p>
    <a class="tags-link" href={`/${getLink('tags', lang)}`}>{t.nav.tags} →</a>
  </header>

  <PostFrame
    title={t.posts.blogTitle}
    description={t.posts.blogSubtitle}
    posts={posts}
    readMoreLabel={t.posts.readMore}
    readTimeLabel={t.posts.readTime}
  />

  <PostFrame
    title={t.posts.noteTitle}
    description={t.posts.noteSubtitle}
    posts={notes}
    readMoreLabel={t.posts.readMore}
    readTimeLabel={t.posts.readTime}
  />
</main>

<style>
  .posts-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  /* .kicker / .page-title / .page-sub live in main.css */
  .page-head {
    margin-bottom: 56px;
  }

  .page-title {
    margin-bottom: 12px;
  }

  .tags-link {
    display: inline-block;
    margin-top: 14px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  @media (max-width: 768px) {
    .posts-page {
      padding-top: 96px;
    }
  }
</style>
