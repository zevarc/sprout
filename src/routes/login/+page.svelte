<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  let token = $state('');
  let error = $state('');
  let busy = $state(false);

  /** Where to go after signing in — same-origin paths only. */
  const next = $derived.by(() => {
    const value = $page.url.searchParams.get('next') ?? '/';
    return value.startsWith('/') && !value.startsWith('//') ? value : '/';
  });

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    if (busy || !token) return;
    busy = true;
    error = '';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) await goto(next);
      else error = '登录失败，请检查令牌。';
    } catch {
      error = '登录失败，请稍后再试。';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{pageTitle('登录')}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<PageLogo href="/" />

<main class="login-page">
  <h1>进入 {site.name}</h1>
  <p class="hint">该区域需要登录后查看。</p>
  <form onsubmit={submit}>
    <input
      type="password"
      bind:value={token}
      placeholder="访问令牌"
      autocomplete="current-password"
      aria-label="访问令牌"
    />
    <button type="submit" disabled={busy || !token}>{busy ? '登录中…' : '登录'}</button>
    {#if error}<span class="error">{error}</span>{/if}
  </form>
</main>

<style>
  .login-page {
    max-width: 420px;
    margin: 0 auto;
    padding: 160px 24px 80px;
  }

  h1 {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(1.8rem, 5vw, 2.4rem);
    letter-spacing: -0.015em;
    margin: 0 0 12px;
    color: var(--color-ink);
  }

  .hint {
    margin: 0 0 28px;
    color: var(--color-text-meta);
    font-size: 0.95rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  input {
    font-family: inherit;
    font-size: 1rem;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--color-paper-line);
    background: var(--color-surface);
    color: var(--color-on-surface);
  }

  input:focus {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
    border-color: transparent;
  }

  button {
    font-family: inherit;
    font-size: 0.95rem;
    padding: 12px 18px;
    border-radius: 10px;
    background: var(--color-action-bg);
    color: var(--color-action-ink);
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: var(--color-action-bg-hover);
  }

  button:active:not(:disabled) {
    background: var(--color-action-bg-active);
  }

  button:disabled {
    background: var(--color-disabled-bg);
    color: var(--color-disabled-ink);
    cursor: not-allowed;
    cursor: not-allowed;
  }

  .error {
    font-size: 0.85rem;
    color: var(--color-error);
  }
</style>
