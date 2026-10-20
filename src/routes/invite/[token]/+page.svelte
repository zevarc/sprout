<script>
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const token = $derived($page.params.token ?? '');

  let phase = $state('loading');
  let label = $state('');

  $effect(() => {
    const t = token;
    if (!t) {
      phase = 'invalid';
      return;
    }
    fetch(`/api/auth/invite?token=${encodeURIComponent(t)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.valid) {
          label = data.label ?? '';
          phase = 'valid';
        } else {
          phase = 'invalid';
        }
      })
      .catch(() => {
        phase = 'invalid';
      });
  });

  async function join() {
    if (phase === 'joining') return;
    phase = 'joining';
    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) await goto('/');
      else phase = 'invalid';
    } catch {
      phase = 'invalid';
    }
  }
</script>

<svelte:head>
  <title>{pageTitle('邀请')}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<PageLogo href="/" />

<main class="invite-page">
  <h1>加入 {site.name}</h1>

  {#if phase === 'loading'}
    <p class="hint">正在检查邀请…</p>
  {:else if phase === 'invalid'}
    <p class="hint">这个邀请无效、已使用或已过期。</p>
  {:else}
    <p class="hint">
      {label ? `「${label}」，` : ''}接受邀请后即可登录并记录。
    </p>
    <button type="button" onclick={join} disabled={phase === 'joining'}>
      {phase === 'joining' ? '加入中…' : '接受邀请'}
    </button>
  {/if}
</main>

<style>
  .invite-page {
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
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  button {
    font-family: inherit;
    font-size: 0.95rem;
    padding: 12px 18px;
    border-radius: 10px;
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
</style>
