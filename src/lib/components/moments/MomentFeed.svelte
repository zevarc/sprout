<script>
  import { getDictionary } from '$lib/i18n/index.js';

  let { moments = [], lang = 'en' } = $props();

  const t = $derived(getDictionary(lang));
  const m = $derived(t.moments);

  /**
   * @param {string} iso
   */
  function formatDate(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * @param {any} moment
   */
  function images(moment) {
    const value = moment.extra?.images;
    return Array.isArray(value) ? value : [];
  }
</script>

{#if moments.length === 0}
  <p class="empty">{m.empty}</p>
{:else}
  <ol class="timeline">
    {#each moments as moment (moment.id)}
      <li class="moment">
        <a class="moment-date" href={`/${moment.url}`}>{formatDate(moment.date)}</a>
        <div class="moment-body">
          <div class="moment-text">{@html moment.bodyHtml}</div>
          {#if images(moment).length > 0}
            <div class="moment-media">
              {#each images(moment) as src}
                <img src={src} alt="" loading="lazy" decoding="async" />
              {/each}
            </div>
          {/if}
          <a class="moment-link" href={`/${moment.url}`}>·</a>
        </div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .empty {
    color: var(--text-muted);
  }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
  }

  .timeline::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: var(--color-paper-line);
  }

  .moment {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 24px;
    padding: 18px 0 18px 28px;
    position: relative;
  }

  .moment::before {
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

  .moment-date {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--color-bud);
    border: none;
    padding-top: 2px;
  }

  .moment-text {
    font-size: 0.98rem;
    line-height: 1.75;
    color: var(--color-on-surface);
  }

  .moment-text :global(p) {
    margin: 0 0 0.6em;
  }

  .moment-media {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
    margin-top: 10px;
  }

  .moment-media img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--border-color);
  }

  .moment-link {
    display: inline-block;
    margin-top: 6px;
    font-family: var(--font-mono);
    color: var(--color-ink-faint);
    border: none;
  }

  @media (max-width: 640px) {
    .moment {
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }
</style>
