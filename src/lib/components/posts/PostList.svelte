<script>
  import { onMount } from 'svelte';

  const { posts, readMoreLabel = 'Read More →', readTimeLabel = 'min read' } = $props();

  let visible = $state(false);
  /** @type {HTMLDivElement | null} */
  let sectionEl = null;

  /**
   * @param {string} dateStr
   */
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible = true;
        });
      },
      { threshold: 0.05 }
    );
    if (sectionEl) observer.observe(sectionEl);
    return () => observer.disconnect();
  });
</script>

<div class="post-list" bind:this={sectionEl} class:visible>
  {#each posts as post, i}
    <div class="post-item">
      <a class="post-row" href={`/${post.url}`}>
        <span class="post-index">{String(i + 1).padStart(2, '0')}</span>
        <span class="post-date">{formatDate(post.date)}</span>
        <span class="post-title">{post.title}</span>
        {#if post.readTime}
          <span class="post-time">{post.readTime} {readTimeLabel}</span>
        {/if}
      </a>
    </div>
  {/each}
</div>

<style>
  .post-list {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }

  .post-list.visible {
    opacity: 1;
    transform: none;
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

  @media (max-width: 767px) {
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
    .post-list {
      opacity: 1;
      transform: none;
    }
  }
</style>
