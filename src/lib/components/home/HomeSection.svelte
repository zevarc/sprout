<script>
  import { onMount } from 'svelte';
  import { getDictionary, getLink } from '$lib/i18n/index.js';
  import { site } from '$lib/site';

  /**
   * One configured home section. The *engine* knows two generic layouts
   * (`list`, `cards`); the site chooses which section shows which types.
   * @type {{
   *   section: import('$lib/content/schema').HomeSection,
   *   items?: import('$lib/content/view').PostView[],
   *   lang?: string
   * }}
   */
  let { section, items = [], lang = site.defaultLocale } = $props();

  const t = $derived(getDictionary(lang));
  let visible = $state(false);
  /** @type {HTMLElement | null} */
  let el = $state(null);

  /** Resolve a dotted i18n key against the dictionary, falling back to the key. */
  /** @param {string} key */
  function tx(key) {
    /** @type {any} */
    let cur = t;
    for (const part of key.split('.')) cur = cur == null ? undefined : cur[part];
    return typeof cur === 'string' ? cur : key;
  }

  /** @param {string} iso */
  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  /** @param {unknown} value */
  function isUrl(value) {
    return typeof value === 'string' && /^https?:\/\//.test(value);
  }

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) visible = true;
      },
      { threshold: 0.06 }
    );
    if (el) observer.observe(el);
    return () => observer.disconnect();
  });
</script>

{#if items.length > 0}
  <section class="section" bind:this={el} class:visible>
    <div class="section-head">
      <h2 class="section-label">{tx(section.title)}</h2>
      <a class="section-more" href={`/${getLink(section.morePath, lang)}`}>{tx(section.more)}</a>
    </div>

    {#if section.layout === 'cards'}
      <div class="cards">
        {#each items as item (item.id)}
          <article class="card">
            <a class="card-title" href={`/${item.url}`}>{item.title}</a>
            {#if item.excerpt}<p class="card-excerpt">{item.excerpt}</p>{/if}
            {#if section.fields?.length}
              <div class="card-fields">
                {#each section.fields as field}
                  {#if item.extra?.[field] != null && item.extra[field] !== ''}
                    {#if isUrl(item.extra[field])}
                      <a class="card-field link" href={String(item.extra[field])} target="_blank" rel="noopener">
                        {field}
                      </a>
                    {:else}
                      <span class="card-field">{String(item.extra[field])}</span>
                    {/if}
                  {/if}
                {/each}
              </div>
            {/if}
            {#if item.tags.length > 0}
              <div class="card-tags">
                {#each item.tags as tag}<span class="pill">{tag}</span>{/each}
              </div>
            {/if}
          </article>
        {/each}
      </div>
    {:else}
      <ul class="post-list">
        {#each items as item, i (item.id)}
          <li class="post-item">
            <a class="post-row" href={`/${item.url}`}>
              <span class="post-index">{String(i + 1).padStart(2, '0')}</span>
              <span class="post-date">{formatDate(item.date)}</span>
              <span class="post-title">{item.title}</span>
              <span class="post-time">{item.readTime} {t.posts.readTime}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .section {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 110px clamp(20px, 5vw, 48px) 40px;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  .section.visible {
    opacity: 1;
    transform: none;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0 0 20px;
    border-bottom: 1px solid var(--color-paper-line);
    padding-bottom: 12px;
  }

  .section-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-ink-faint);
    margin: 0;
  }

  .section-more {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-bud);
    letter-spacing: 0.08em;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s, color 0.2s;
  }

  .section-more:hover {
    border-bottom-color: var(--color-bud);
    color: var(--color-bud-deep);
  }

  /* ---------- list ---------- */
  .post-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .post-item {
    position: relative;
  }

  .post-row {
    display: grid;
    grid-template-columns: 40px 92px 1fr auto;
    align-items: baseline;
    gap: 16px;
    padding: 15px 4px;
    border: none;
    color: var(--color-ink);
    border-bottom: 1px solid var(--color-paper-line);
    transition: color 0.2s;
  }

  .post-row::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 50%;
    width: 10px;
    height: 2px;
    border-radius: 2px;
    background: var(--color-bud);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.28s ease;
  }

  .post-row:hover::before {
    transform: scaleX(1);
  }

  .post-row:hover {
    color: var(--color-bud-deep);
  }

  .post-index {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-bud);
    opacity: 0.85;
  }

  .post-date {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-ink-faint);
  }

  .post-title {
    font-family: var(--font-serif);
    font-size: 1.12rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .post-time {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-faint);
    white-space: nowrap;
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
    gap: 10px;
    padding: 22px 24px;
    border: 1px solid var(--color-paper-line);
    border-radius: var(--radius, 12px);
    background: var(--color-surface);
    transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
  }

  .card:hover {
    border-color: var(--color-bud-soft);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .card-title {
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--color-ink);
    border: none;
  }

  .card-title:hover {
    color: var(--color-bud);
  }

  .card-excerpt {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.65;
    color: var(--color-ink-soft);
  }

  .card-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--color-ink-soft);
  }

  .card-field.link {
    color: var(--color-bud-deep);
    border: none;
  }

  .card-field.link:hover {
    color: var(--color-bud);
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--color-paper-line);
  }

  .card-tags .pill {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 4px 10px;
  }

  @media (max-width: 820px) {
    .section {
      padding-top: 80px;
    }

    .cards {
      grid-template-columns: 1fr;
    }

    .post-row {
      grid-template-columns: 32px 1fr;
      gap: 12px;
    }

    .post-date {
      grid-column: 2;
      grid-row: 1;
      margin-top: -10px;
    }

    .post-time {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .section {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .post-row::before,
    .card {
      transition: none;
    }
  }
</style>
