<script>
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { site } from '$lib/site';
  import { labelText } from '$lib/content/registry';
  import { formatDate, getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { pageTitle } from '$lib/seo';

  /**
   * Generic list page for any registry type (see `/[type]`). One page shell,
   * three entry layouts. A site overrides a type's look with a static route.
   * @type {{
   *   type: import('$lib/content/schema').ContentTypeDef,
   *   entries?: import('$lib/content/view').PostView[],
   *   lang?: string,
   *   layout?: 'list' | 'cards' | 'feed'
   * }}
   */
  let { type, entries = [], lang = site.defaultLocale, layout = 'list' } = $props();

  const t = $derived(getDictionary(lang));
  const heading = $derived(labelText(type.label, lang, type.type));
  const home = $derived(homePath(lang));
  const basePath = $derived(`/${getLink(type.route.replace(/^\//, ''), lang)}`);

  /** @param {any} entry */
  function images(entry) {
    return Array.isArray(entry.media) ? entry.media : [];
  }
</script>

<svelte:head>
  <title>{pageTitle(heading)}</title>
  <link rel="canonical" href={`${site.url}${basePath}`} />
</svelte:head>

<PageLogo href={home} />

<main class="content-page">
  <header class="page-head">
    <p class="kicker">{type.route.replace(/^\//, '')}</p>
    <h1 class="page-title">{heading}</h1>
  </header>

  {#if entries.length === 0}
    <p class="empty">{t.common?.empty ?? ''}</p>
  {:else if layout === 'cards'}
    <div class="cards">
      {#each entries as entry (entry.id)}
        <a class="card" href={`/${entry.url}`}>
          <span class="card-date">{formatDate(entry.occurredAt ?? entry.date, lang)}</span>
          <span class="card-title">{entry.title}</span>
          {#if entry.excerpt}<span class="card-excerpt">{entry.excerpt}</span>{/if}
          {#if entry.tags.length > 0}
            <span class="card-tags">
              {#each entry.tags as tag}<span class="pill">{tag}</span>{/each}
            </span>
          {/if}
        </a>
      {/each}
    </div>
  {:else if layout === 'feed'}
    <ol class="feed">
      {#each entries as entry (entry.id)}
        <li class="feed-item">
          <a class="feed-date" href={`/${entry.url}`}>
            {formatDate(entry.occurredAt ?? entry.date, lang)}
          </a>
          <div class="feed-body">
            <div class="feed-text">{@html entry.bodyHtml}</div>
            {#if images(entry).length > 0}
              <div class="feed-media">
                {#each images(entry) as image}
                  <img src={image.url} alt={image.alt ?? ''} loading="lazy" decoding="async" />
                {/each}
              </div>
            {/if}
            <a class="feed-link" href={`/${entry.url}`} aria-label={entry.title}>·</a>
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <ul class="entry-list">
      {#each entries as entry (entry.id)}
        <li class="entry">
          <a class="entry-link" href={`/${entry.url}`}>
            <time class="entry-date" datetime={entry.occurredAt ?? entry.date}>
              {formatDate(entry.occurredAt ?? entry.date, lang)}
            </time>
            <span class="entry-title">{entry.title}</span>
            {#if entry.excerpt}
              <span class="entry-excerpt">{entry.excerpt}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .content-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  /* .kicker / .page-title live in main.css */
  .page-head {
    margin-bottom: 40px;
  }

  .empty {
    color: var(--text-muted);
  }

  /* ---------- list ---------- */
  .entry-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .entry {
    position: relative;
  }

  .entry-link {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 6px 18px;
    padding: 16px 4px;
    border: none;
    border-bottom: 1px solid var(--color-paper-line);
    color: var(--color-ink);
    transition: color 0.2s;
  }

  .entry-link:hover {
    color: var(--color-bud-deep);
  }

  .entry-date {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-bud);
    padding-top: 4px;
  }

  .entry-title {
    font-family: var(--font-serif);
    font-size: 1.12rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .entry-excerpt {
    grid-column: 2;
    font-size: 0.92rem;
    line-height: 1.65;
    color: var(--color-ink-soft);
  }

  /* ---------- cards ---------- */
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px 22px;
    border: 1px solid var(--color-paper-line);
    border-radius: 14px;
    background: var(--color-surface);
    color: var(--color-ink);
    transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
  }

  .card:hover {
    border-color: var(--color-bud-soft);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .card-date {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--color-bud);
  }

  .card-title {
    font-family: var(--font-serif);
    font-size: 1.2rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .card-excerpt {
    font-size: 0.92rem;
    line-height: 1.65;
    color: var(--color-ink-soft);
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
    padding-top: 10px;
  }

  .card-tags .pill {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 4px 10px;
  }

  /* ---------- feed ---------- */
  .feed {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
  }

  .feed::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: var(--color-paper-line);
  }

  .feed-item {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 24px;
    padding: 18px 0 18px 28px;
    position: relative;
  }

  .feed-item::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 24px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--color-paper);
    border: 2px solid var(--color-bud-soft);
  }

  .feed-date {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--color-bud);
    border: none;
    padding-top: 2px;
  }

  .feed-text {
    font-size: 0.98rem;
    line-height: 1.75;
    color: var(--color-on-surface);
  }

  .feed-text :global(p) {
    margin: 0 0 0.6em;
  }

  .feed-media {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .feed-media img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--border-color);
  }

  .feed-link {
    display: inline-block;
    margin-top: 6px;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
    border: none;
  }

  @media (max-width: 640px) {
    .content-page {
      padding-top: 96px;
    }

    .entry-link,
    .cards {
      grid-template-columns: 1fr;
    }

    .entry-excerpt {
      grid-column: 1;
    }

    .feed-item {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>
