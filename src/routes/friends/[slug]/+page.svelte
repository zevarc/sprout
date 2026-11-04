<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { formatDate, getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { data } = $props();
  const { post, lang = site.defaultLocale } = $derived(data);

  const t = $derived(getDictionary(lang));
  const f = $derived(t.friends);
  const home = $derived(homePath(lang));
  const listPath = $derived(`/${getLink('friends', lang)}`);

  const url = $derived(typeof post.fields?.url === 'string' ? post.fields.url : '');
  const avatar = $derived(typeof post.fields?.avatar === 'string' ? post.fields.avatar : null);
  const feed = $derived(typeof post.fields?.feed === 'string' ? post.fields.feed : null);
  const host = $derived.by(() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  });
</script>

<svelte:head>
  <title>{pageTitle(post.title)}</title>
  <meta name="description" content={post.description} />
  <link rel="canonical" href={`${site.url}/${post.url}`} />
</svelte:head>

<LanguageSwitcher />
<PageLogo href={home} />

<main class="friend-page">
  <a class="back" href={listPath}>← {t.nav.friends}</a>

  <article class="card friend-profile">
    <header class="profile-head">
      {#if avatar}
        <img class="avatar" src={avatar} alt="" width="64" height="64" loading="lazy" decoding="async" />
      {:else}
        <span class="avatar initial" aria-hidden="true">{post.title.trim()[0]?.toUpperCase() ?? '?'}</span>
      {/if}
      <div class="profile-meta">
        <h1>{post.title}</h1>
        {#if host}<span class="host">{host}</span>{/if}
      </div>
    </header>

    {#if post.description}<p class="description">{post.description}</p>{/if}

    <div class="profile-links">
      {#if url}
        <a class="visit" href={url} target="_blank" rel="noopener noreferrer">
          {f.visit} <span aria-hidden="true">↗</span>
        </a>
      {/if}
      {#if feed}
        <a class="secondary" href={feed} target="_blank" rel="noopener noreferrer">{f.feedLabel}</a>
      {/if}
      <span class="since">{f.since} {formatDate(post.date, lang)}</span>
    </div>

    {#if post.tags.length > 0}
      <div class="tags">
        {#each post.tags as tag}<span class="pill">{tag}</span>{/each}
      </div>
    {/if}

    {#if post.bodyHtml}
      <div class="body">{@html post.bodyHtml}</div>
    {/if}
  </article>
</main>

<style>
  .friend-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 128px clamp(20px, 5vw, 48px) 140px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    margin-bottom: 22px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    color: var(--color-ink-faint);
    text-decoration: none;
  }

  .back:hover {
    color: var(--color-bud-deep);
  }

  .friend-profile {
    padding: 28px 30px;
  }

  .profile-head {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
  }

  .avatar {
    flex: 0 0 auto;
    width: 64px;
    height: 64px;
    border-radius: 14px;
    border: 1px solid var(--color-paper-line);
    object-fit: cover;
    background: var(--color-surface-container);
  }

  .avatar.initial {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-serif);
    font-size: 1.8rem;
    color: var(--color-bud-deep);
  }

  .profile-meta h1 {
    margin: 0 0 4px;
    font-family: var(--font-serif);
    font-size: clamp(1.5rem, 4vw, 2rem);
    color: var(--color-ink);
  }

  .host {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--color-ink-faint);
  }

  .description {
    margin: 0 0 20px;
    font-size: 1rem;
    line-height: 1.7;
    color: var(--color-ink-soft);
  }

  .profile-links {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding-top: 16px;
    border-top: 1px solid var(--color-paper-line);
  }

  .visit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    padding: 6px 16px;
    border-radius: 999px;
    background: var(--color-action-bg);
    color: var(--color-action-ink);
    font-size: 0.86rem;
    text-decoration: none;
  }

  .visit:hover {
    background: var(--color-action-bg-hover);
  }

  .visit:active {
    background: var(--color-action-bg-active);
  }

  .secondary {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-faint);
    text-decoration: none;
  }

  .secondary:hover {
    color: var(--color-bud-deep);
  }

  .since {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-ink-faint);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;
  }

  .tags .pill {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 2px 8px;
  }

  .body {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--color-paper-line);
    line-height: 1.75;
    color: var(--color-ink);
  }
</style>
