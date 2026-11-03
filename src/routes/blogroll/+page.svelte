<script>
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { data } = $props();
  const { blogs, picks, latest } = $derived(data);

  /** @param {string | null} iso */
  const fmtDate = (iso) =>
    iso ? new Date(iso).toISOString().slice(0, 10).replaceAll('-', '.') : '';
</script>

<svelte:head>
  <title>{pageTitle('Blogroll')}</title>
  <meta name="description" content="Independent blogs discovered daily by Zevprobe." />
</svelte:head>

<PageLogo href="/" />

<main class="blogroll-page">
  <header class="page-head">
    <p class="kicker">{site.name}</p>
    <h1 class="page-title">Blogroll</h1>
    <p class="page-sub">
      One independent blog, discovered every day — still updating, verified by feed.
      <span class="count">{blogs.length} blogs · {picks.length} picks</span>
    </p>
  </header>

  {#if latest?.blog}
    <a class="today" href={latest.blog.url} rel="noopener noreferrer" target="_blank">
      <span class="today-label">Today's discovery · {fmtDate(latest.pickDate)}</span>
      <span class="today-title">{latest.blog.title}</span>
      {#if latest.blog.description}<span class="today-desc">{latest.blog.description}</span>{/if}
    </a>
  {/if}

  <ol class="blog-list">
    {#each blogs as blog, i (blog.id)}
      <li>
        <a class="blog-row" href={blog.url} rel="noopener noreferrer" target="_blank">
          <span class="num">{String(i + 1).padStart(2, '0')}</span>
          <span class="meta">
            <span class="title">{blog.title}</span>
            {#if blog.description}<span class="desc">{blog.description}</span>{/if}
            <span class="url">{new URL(blog.url).hostname}</span>
          </span>
          <span class="date">{fmtDate(blog.lastPostAt)}</span>
        </a>
      </li>
    {/each}
  </ol>

  {#if blogs.length === 0}
    <p class="empty">Nothing synced yet — run <code>pnpm blogs:sync</code> against the discovery service.</p>
  {/if}
</main>

<style>
  .blogroll-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  .page-head {
    margin-bottom: 40px;
  }

  .kicker {
    font-size: 0.8rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.6;
  }

  .page-title {
    font-size: clamp(2rem, 6vw, 3rem);
    margin: 0.2em 0;
  }

  .page-sub {
    opacity: 0.7;
    margin: 0;
  }

  .count {
    display: block;
    margin-top: 0.4em;
    font-variant-numeric: tabular-nums;
    font-size: 0.85em;
  }

  .today {
    display: block;
    border: 1px solid var(--line, rgba(128, 128, 128, 0.3));
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 40px;
    text-decoration: none;
    color: inherit;
    background: var(--surface, rgba(128, 128, 128, 0.06));
  }

  .today-label {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.6;
    margin-bottom: 0.5em;
  }

  .today-title {
    display: block;
    font-size: 1.3rem;
    font-weight: 600;
  }

  .today-desc {
    display: block;
    margin-top: 0.4em;
    opacity: 0.7;
    font-size: 0.95rem;
  }

  .blog-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .blog-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 14px 4px;
    text-decoration: none;
    color: inherit;
    border-top: 1px solid var(--line, rgba(128, 128, 128, 0.2));
  }

  .blog-list li:last-child .blog-row {
    border-bottom: 1px solid var(--line, rgba(128, 128, 128, 0.2));
  }

  .num {
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    opacity: 0.5;
    min-width: 2em;
  }

  .meta {
    flex: 1;
    min-width: 0;
  }

  .title {
    display: block;
    font-weight: 600;
  }

  .desc {
    display: block;
    font-size: 0.9rem;
    opacity: 0.65;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .url {
    display: block;
    font-size: 0.75rem;
    opacity: 0.45;
  }

  .date {
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.55;
    white-space: nowrap;
  }

  .empty {
    opacity: 0.6;
  }
</style>
