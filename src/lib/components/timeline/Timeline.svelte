<script>
  import { getContentType, labelText } from '$lib/content/registry';
  import { site } from '$lib/site';

  /**
   * @type {{
   *   entries?: import('$lib/content/view').PostView[],
   *   authors?: Record<string, string>,
   *   lang?: string
   * }}
   */
  let { entries = [], authors = {}, lang = site.defaultLocale } = $props();

  /** @param {string} type */
  function typeLabel(type) {
    return labelText(getContentType(type)?.label, lang, type);
  }

  /** @param {any} entry */
  function images(entry) {
    const value = entry.extra?.images;
    return Array.isArray(value) ? value : [];
  }

  /** @param {string} iso */
  function dayLabel(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  // Group into month buckets so a long timeline stays scannable.
  const groups = $derived.by(() => {
    /** @type {{ key: string, label: string, items: import('$lib/content/view').PostView[] }[]} */
    const out = [];
    /** @type {{ key: string, label: string, items: import('$lib/content/view').PostView[] } | null} */
    let current = null;
    for (const entry of entries) {
      const d = new Date(entry.occurredAt ?? entry.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!current || current.key !== key) {
        current = { key, label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, items: [] };
        out.push(current);
      }
      current.items.push(entry);
    }
    return out;
  });
</script>

{#if entries.length === 0}
  <p class="empty">还没有记录。</p>
{:else}
  <div class="timeline">
    {#each groups as group (group.key)}
      <section class="month">
        <h2 class="month-label">{group.label}</h2>
        <ol class="entries">
          {#each group.items as entry (entry.id)}
            <li class="entry">
              <span class="rail" aria-hidden="true"></span>
              <a class="entry-head" href={`/${entry.url}`}>
                <span class="entry-date">{dayLabel(entry.occurredAt ?? entry.date)}</span>
                <span class="badge type">{typeLabel(entry.type)}</span>
                {#if entry.authorActorId && authors[entry.authorActorId]}
                  <span class="badge author">{authors[entry.authorActorId]}</span>
                {/if}
                {#if entry.visibility === 'private'}
                  <span class="badge private">private</span>
                {/if}
              </a>

              {#if entry.title}
                <a class="entry-title" href={`/${entry.url}`}>{entry.title}</a>
              {/if}

              <div class="entry-body">{@html entry.bodyHtml}</div>

              {#if images(entry).length > 0}
                <div class="entry-media">
                  {#each images(entry) as src}
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  {/each}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  </div>
{/if}

<style>
  .empty {
    color: var(--text-muted);
  }

  .month {
    margin-bottom: 44px;
  }

  .month-label {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    color: var(--color-ink-faint);
    margin: 0 0 18px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-paper-line);
  }

  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .entry {
    position: relative;
    padding: 0 0 26px 26px;
  }

  /* vertical rail with a node dot per entry */
  .rail {
    position: absolute;
    left: 4px;
    top: 8px;
    bottom: -6px;
    width: 1px;
    background: var(--color-paper-line);
  }

  .entry:last-child .rail {
    bottom: 26px;
  }

  .entry::before {
    content: '';
    position: absolute;
    left: 0;
    top: 7px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--color-paper);
    border: 2px solid var(--color-bud-soft);
  }

  .entry-head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border: none;
  }

  .entry-date {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--color-bud);
  }

  .badge {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.06em;
    padding: 1px 8px;
    border-radius: 999px;
  }

  .badge.type {
    background: var(--color-bud-pale);
    color: var(--color-bud-deep);
  }

  .badge.author {
    background: var(--color-surface-container);
    color: var(--color-ink-soft);
  }

  .badge.private {
    border: 1px solid var(--color-paper-line);
    color: var(--color-ink-faint);
  }

  .entry-title {
    display: block;
    margin-top: 8px;
    font-family: var(--font-serif);
    font-size: 1.05rem;
    font-weight: 500;
    line-height: 1.4;
    color: var(--color-ink);
    border: none;
  }

  .entry-title:hover {
    color: var(--color-bud-deep);
  }

  .entry-body {
    margin-top: 8px;
    font-size: 0.96rem;
    line-height: 1.75;
    color: var(--color-on-surface);
  }

  .entry-body :global(p) {
    margin: 0 0 0.6em;
  }

  .entry-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .entry-media {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
    margin-top: 12px;
  }

  .entry-media img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--border-color);
  }
</style>
