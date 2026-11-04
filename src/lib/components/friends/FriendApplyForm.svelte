<script>
  import { getDictionary } from '$lib/i18n/index.js';
  import { site } from '$lib/site';

  /**
   * The public application form. Nothing is published on submit: the request
   * lands in a moderation queue and an admin approves it.
   * @type {{ lang?: string }}
   */
  let { lang = site.defaultLocale } = $props();

  const t = $derived(getDictionary(lang));
  const f = $derived(t.friends.apply);

  let name = $state('');
  let url = $state('');
  let description = $state('');
  let avatar = $state('');
  let feed = $state('');
  let linksPage = $state('');
  let email = $state('');
  let message = $state('');
  let website = $state(''); // honeypot — must stay empty

  let submitting = $state(false);
  let notice = $state('');
  let formError = $state('');

  /** @param {SubmitEvent} event */
  async function submit(event) {
    event.preventDefault();
    formError = '';
    notice = '';
    if (!name.trim() || !url.trim()) {
      formError = f.required;
      return;
    }

    submitting = true;
    try {
      const res = await fetch('/api/friends/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          description,
          avatar,
          feed,
          linksPage,
          email,
          message,
          lang,
          website
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        formError = f.duplicate;
      } else if (res.status === 429) {
        formError = f.rateLimited;
      } else if (res.status === 400 && String(data.error ?? '').includes('url')) {
        formError = f.invalidUrl;
      } else if (!res.ok) {
        formError = f.failed;
      } else {
        notice = f.success;
        name = '';
        url = '';
        description = '';
        avatar = '';
        feed = '';
        linksPage = '';
        email = '';
        message = '';
      }
    } catch {
      formError = f.failed;
    } finally {
      submitting = false;
    }
  }
</script>

<section class="apply" id="apply">
  <header class="apply-head">
    <h2 class="apply-title">{f.title}</h2>
    <p class="apply-intro">{f.intro}</p>
  </header>

  <ul class="rules">
    {#each f.rules as rule}<li>{rule}</li>{/each}
  </ul>

  <div class="own-info">
    <span class="own-label">{f.ownInfo}</span>
    <span class="own-row"><span class="own-key">{f.name}</span><code>{site.name}</code></span>
    <span class="own-row"><span class="own-key">{f.url}</span><code>{site.url}</code></span>
  </div>

  <form class="apply-form card" onsubmit={submit}>
    <div class="row">
      <label>
        <span class="label">{f.name} *</span>
        <input type="text" bind:value={name} maxlength="80" required autocomplete="organization" />
      </label>
      <label>
        <span class="label">{f.url} *</span>
        <input type="url" bind:value={url} maxlength="2048" required placeholder="https://" />
      </label>
    </div>

    <label>
      <span class="label">{f.description}</span>
      <input type="text" bind:value={description} maxlength="300" />
    </label>

    <div class="row">
      <label>
        <span class="label">{f.avatar}</span>
        <input type="url" bind:value={avatar} maxlength="2048" placeholder="https://" />
      </label>
      <label>
        <span class="label">{f.feed}</span>
        <input type="url" bind:value={feed} maxlength="2048" placeholder="https://" />
      </label>
    </div>

    <div class="row">
      <label>
        <span class="label">{f.linksPage}</span>
        <input type="url" bind:value={linksPage} maxlength="2048" placeholder="https://" />
      </label>
      <label>
        <span class="label">{f.email}</span>
        <input type="email" bind:value={email} maxlength="200" autocomplete="email" />
      </label>
    </div>

    <label>
      <span class="label">{f.message}</span>
      <textarea bind:value={message} rows="3" maxlength="1000"></textarea>
    </label>

    <!-- honeypot: hidden from humans, tempting to bots -->
    <div class="hp" aria-hidden="true">
      <label>Website<input type="text" bind:value={website} tabindex="-1" autocomplete="off" /></label>
    </div>

    <div class="actions">
      <button type="submit" disabled={submitting}>
        {submitting ? f.submitting : f.submit}
      </button>
      {#if formError}<span class="error" role="alert">{formError}</span>{/if}
      {#if notice}<span class="notice" role="status">{notice}</span>{/if}
    </div>
  </form>
</section>

<style>
  .apply {
    margin-top: 72px;
    padding-top: 40px;
    border-top: 1px solid var(--color-paper-line);
  }

  .apply-title {
    margin: 0 0 10px;
    font-family: var(--font-serif);
    font-size: 1.5rem;
    color: var(--color-ink);
  }

  .apply-intro {
    margin: 0 0 18px;
    font-size: 0.95rem;
    line-height: 1.7;
    color: var(--color-ink-soft);
  }

  .rules {
    margin: 0 0 24px;
    padding-left: 1.2em;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.88rem;
    line-height: 1.6;
    color: var(--color-ink-soft);
  }

  .own-info {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 24px;
    padding: 14px 16px;
    border-left: 3px solid var(--color-bud-soft);
    background: var(--color-surface-container-low);
  }

  .own-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-ink-faint);
  }

  .own-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-size: 0.85rem;
  }

  .own-key {
    min-width: 5em;
    color: var(--color-ink-faint);
  }

  .own-row code {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-ink);
    word-break: break-all;
  }

  .apply-form {
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
    outline: 2px solid var(--focus-ring);
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
    flex-wrap: wrap;
  }

  button {
    font-family: inherit;
    font-size: 0.88rem;
    padding: 8px 18px;
    border-radius: 999px;
    background: var(--color-action-bg);
    color: var(--color-action-ink);
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover:not(:disabled) {
    background: var(--color-action-bg-hover);
  }

  button:disabled {
    background: var(--color-disabled-bg);
    color: var(--color-disabled-ink);
    cursor: not-allowed;
    cursor: not-allowed;
  }

  .notice {
    font-size: 0.82rem;
    color: var(--color-success);
  }

  .error {
    font-size: 0.82rem;
    color: var(--color-error);
  }

  @media (max-width: 640px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
