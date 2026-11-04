<script>
  import { formatDate, getDictionary } from '$lib/i18n/index.js';
  import { site } from '$lib/site';

  /**
   * The friend-link card wall. Cards point outward — a friend link's whole job
   * is to leave the site — while the small arrow opens the local profile page.
   * @type {{
   *   friends: import('$lib/content/view').FriendView[],
   *   lang?: string
   * }}
   */
  let { friends = [], lang = site.defaultLocale } = $props();

  const t = $derived(getDictionary(lang));
  const f = $derived(t.friends);

  /** @param {string} url */
  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  /** @param {string} title */
  function initial(title) {
    return (title.trim()[0] ?? '?').toUpperCase();
  }
</script>

{#if friends.length === 0}
  <p class="empty">{f.empty}</p>
{:else}
  <ul class="friend-grid">
    {#each friends as friend, i (friend.id)}
      <li class="friend-card card" style="animation-delay: {i * 60}ms">
        <a
          class="friend-main"
          href={friend.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${friend.title} — ${hostOf(friend.url)}`}
        >
          {#if friend.avatar}
            <img
              class="friend-avatar"
              src={friend.avatar}
              alt=""
              width="48"
              height="48"
              loading="lazy"
              decoding="async"
            />
          {:else}
            <span class="friend-avatar friend-initial" aria-hidden="true">{initial(friend.title)}</span>
          {/if}

          <span class="friend-meta">
            <span class="friend-title">{friend.title}</span>
            {#if friend.description}
              <span class="friend-desc">{friend.description}</span>
            {/if}
            <span class="friend-host">{hostOf(friend.url)}</span>
          </span>
        </a>

        <div class="friend-foot">
          {#if friend.tags.length > 0}
            <span class="friend-tags">
              {#each friend.tags as tag}<span class="pill">{tag}</span>{/each}
            </span>
          {/if}
          <span class="friend-actions">
            {#if friend.feed}
              <a
                class="friend-feed"
                href={friend.feed}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${friend.title} — ${f.feedLabel}`}
                title={f.feedLabel}
              >RSS</a>
            {/if}
            <a class="friend-profile" href={`/${friend.detailUrl}`} title={f.profileLabel}>
              {formatDate(friend.since, lang)}
            </a>
          </span>
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .empty {
    color: var(--color-ink-soft);
  }

  .friend-grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .friend-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 20px;
    opacity: 0;
    transform: translateY(12px);
    animation: card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
  }

  .friend-card:hover {
    border-color: var(--color-bud-soft);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }


  .friend-card:active {
    transform: none;
    box-shadow: var(--shadow-soft);
  }

  @keyframes card-in {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .friend-main {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    color: inherit;
    text-decoration: none;
  }

  .friend-avatar {
    flex: 0 0 auto;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    border: 1px solid var(--color-paper-line);
    object-fit: cover;
    background: var(--color-surface-container);
  }

  .friend-initial {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: 1.4rem;
    color: var(--color-bud-deep);
  }

  .friend-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .friend-title {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 1.05rem;
    color: var(--color-ink);
  }

  .friend-main:hover .friend-title {
    color: var(--color-bud-deep);
  }

  .friend-desc {
    font-size: 0.88rem;
    line-height: 1.55;
    color: var(--color-ink-soft);
  }

  .friend-host {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-faint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .friend-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--color-paper-line);
  }

  .friend-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .friend-tags .pill {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    padding: 2px 8px;
  }

  .friend-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .friend-feed,
  .friend-profile {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    color: var(--color-ink-faint);
    text-decoration: none;
  }

  .friend-feed:hover,
  .friend-profile:hover {
    color: var(--color-bud-deep);
  }
</style>
