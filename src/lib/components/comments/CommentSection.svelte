<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { formatDate, getDictionary } from '$lib/i18n/index.js';
  import { site } from '$lib/site';

  let { targetType, targetId, lang = site.defaultLocale } = $props();

  const t = $derived(getDictionary(lang));
  const c = $derived(t.comments);

  /** @type {{ ready: boolean, actor: { name: string, avatarUrl: string | null } | null, githubLogin: boolean }} */
  let identity = $state({ ready: false, actor: null, githubLogin: false });

  /** @type {Array<{id:string,parentId:string|null,bodyHtml:string,createdAt:string,author:{name:string,avatarUrl:string|null,isOwner:boolean}}>} */
  let comments = $state([]);
  let loading = $state(true);
  let failed = $state(false);

  let name = $state('');
  let email = $state('');
  let body = $state('');
  let website = $state(''); // honeypot — must stay empty
  let submitting = $state(false);
  let notice = $state('');

  // `lang` travels with the request: a page target resolves to a per-language
  // anchor, and the server refuses to guess the language from the client's word.
  const endpoint = $derived(
    `/api/events?kind=comment&targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}&lang=${encodeURIComponent(lang)}`
  );

  const loginHref = $derived(
    `/api/auth/github?next=${encodeURIComponent($page.url.pathname)}`
  );

  async function load() {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      comments = data.comments ?? [];
      failed = false;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
    loadIdentity();
  });

  async function loadIdentity() {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) return;
      const data = await res.json();
      identity = {
        ready: true,
        actor: data.actor ?? null,
        githubLogin: Boolean(data.githubLogin)
      };
    } catch {
      /* identity is optional — an anonymous comment still works */
    }
  }

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    identity = { ...identity, actor: null };
    name = '';
    email = '';
  }

  /**
   * @param {SubmitEvent} event
   */
  async function submit(event) {
    event.preventDefault();
    if (submitting || !body.trim()) return;
    if (!identity.actor && !name.trim()) return;
    submitting = true;
    notice = '';
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'comment',
          targetType,
          targetId,
          lang,
          name,
          email,
          body,
          website,
          parentId: null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notice = data.error === 'rate limited' ? c.postError : (data.error ?? c.postError);
      } else {
        body = '';
        if (data.status === 'approved') {
          notice = c.posted;
          await load();
        } else {
          notice = c.pending;
        }
      }
    } catch {
      notice = c.postError;
    } finally {
      submitting = false;
    }
  }
</script>

<section class="comments" aria-label={c.title}>
  <div class="section-head">
    <h2 class="section-title">{c.title}</h2>
    <span class="section-count">{String(comments.length).padStart(2, '0')} {c.count}</span>
  </div>

  {#if loading}
    <p class="muted">…</p>
  {:else if failed}
    <p class="muted">{c.loadError}</p>
  {:else if comments.length === 0}
    <p class="muted">{c.empty}</p>
  {:else}
    <ul class="comment-list">
      {#each comments as comment (comment.id)}
        <li class="comment">
          <div class="comment-head">
            {#if comment.author.avatarUrl}
              <img class="avatar" src={comment.author.avatarUrl} alt="" width="28" height="28" />
            {/if}
            <span class="author">{comment.author.name}</span>
            {#if comment.author.isOwner}
              <span class="badge pill">{c.ownerBadge}</span>
            {/if}
            <time class="date" datetime={comment.createdAt}>{formatDate(comment.createdAt, lang)}</time>
          </div>
          <div class="comment-body">{@html comment.bodyHtml}</div>
        </li>
      {/each}
    </ul>
  {/if}

  <form class="comment-form card" onsubmit={submit}>
    {#if identity.actor}
      <p class="identity">
        <span>{c.actingAs.replace('{name}', identity.actor.name)}</span>
        <button type="button" class="linkish" onclick={signOut}>{c.signOut}</button>
      </p>
    {:else if identity.githubLogin}
      <p class="identity">
        <a class="github-login" href={loginHref}>{c.githubSignIn}</a>
        <span class="hint">{c.githubHint}</span>
      </p>
    {/if}

    {#if !identity.actor}
      <div class="row">
        <label>
          <span class="label">{c.name}</span>
          <input type="text" bind:value={name} maxlength="60" autocomplete="nickname" />
        </label>
        <label>
          <span class="label">{c.email}</span>
          <input type="email" bind:value={email} maxlength="120" autocomplete="email" />
        </label>
      </div>
    {/if}

    <!-- honeypot: hidden from humans, tempting to bots -->
    <div class="hp" aria-hidden="true">
      <label>Website<input type="text" bind:value={website} tabindex="-1" autocomplete="off" /></label>
    </div>

    <label>
      <span class="label">{c.body}</span>
      <textarea bind:value={body} rows="4" maxlength="4000" required></textarea>
    </label>

    <div class="actions">
      <button type="submit" disabled={submitting || !body.trim() || (!identity.actor && !name.trim())}>
        {submitting ? c.submitting : c.submit}
      </button>
      {#if notice}<span class="notice">{notice}</span>{/if}
    </div>
  </form>
</section>

<style>
  .comments {
    margin-top: 4rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .section-title {
    font-family: var(--font-serif);
    font-size: 1.25rem;
    margin: 0;
  }

  .section-count {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    color: var(--color-bud);
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.92rem;
  }

  .comment-list {
    list-style: none;
    margin: 0 0 2rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .comment-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .avatar {
    width: 28px;
    height: 28px;
    margin: 0;
    object-fit: cover;
    border-radius: 50%;
    border: 1px solid var(--border-color);
  }

  .author {
    font-weight: 600;
    font-size: 0.92rem;
    color: var(--color-on-surface);
  }

  .badge {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 1px 7px;
  }

  .date {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-faint);
    margin-left: auto;
  }

  .comment-body {
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--color-on-surface);
  }

  .comment-body :global(p) {
    margin: 0 0 0.5em;
  }

  .identity {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-ink-soft);
  }

  .github-login {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  .github-login:hover {
    color: var(--color-bud);
    border-bottom-color: var(--color-bud);
  }

  .hint {
    font-size: 0.78rem;
    color: var(--color-ink-faint);
  }

  .linkish {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0;
    border: none;
    background: none;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--color-ink-faint);
    text-decoration: underline;
  }

  .identity .linkish:hover {
    background: none;
    color: var(--color-bud);
  }

  /* surface + border + radius come from the shared .card class */
  .comment-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  input,
  textarea {
    font-family: inherit;
    font-size: 0.92rem;
    padding: 8px 10px;
    border: 1px solid var(--color-paper-line);
    border-radius: 8px;
    background: var(--color-surface);
    color: var(--color-on-surface);
    resize: vertical;
  }

  input:focus,
  textarea:focus {
    outline: 2px solid var(--color-bud);
    outline-offset: 1px;
    border-color: transparent;
  }

  .hp {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  button {
    font-family: inherit;
    font-size: 0.88rem;
    padding: 8px 18px;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-on-primary);
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: var(--color-bud-deep);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .notice {
    font-size: 0.82rem;
    color: var(--color-bud-deep);
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
  /* iOS Safari zooms the viewport whenever a control below 16px gets focus;
     on a phone that reads as the page suddenly breaking. */
  /* Touch devices zoom on focus below 16px — in landscape too, so this is
     keyed to the input mode as well as the width. */
  @media (max-width: 1024px), (pointer: coarse) {
    input,
    textarea {
      font-size: 1rem;
    }

    .label,
    .badge,
    .section-count {
      font-size: 0.75rem;
    }
  }
@media (max-width: 1024px), (pointer: coarse) {
  .date,
  .section-count,
  .label,
  .badge {
    font-size: 0.75rem;
  }
}
</style>
