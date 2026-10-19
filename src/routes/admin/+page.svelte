<script>
  import { onMount } from 'svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { contentTypes } from '$lib/content/registry';

  let role = $state('loading');
  let token = $state('');
  let loginError = $state('');

  let tab = $state('content');
  let message = $state('');

  /** @type {any[]} */
  let nodes = $state([]);
  /** @type {any} */
  let draft = $state(null);
  let tagsInput = $state('');
  let featured = $state(false);
  let projectStatus = $state('');
  let imagesInput = $state('');
  let website = $state('');
  let github = $state('');
  let showPreview = $state(false);
  let previewHtml = $state('');

  /** @type {any[]} */
  let queue = $state([]);
  /** @type {any} */
  let stats = $state(null);
  let uploading = $state(false);

  const types = Object.values(contentTypes).map((t) => t.type);

  async function checkSession() {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      role = data.isOwner ? 'owner' : 'visitor';
    } catch {
      role = 'visitor';
    }
  }

  onMount(checkSession);

  /** @param {SubmitEvent} e */
  async function login(e) {
    e.preventDefault();
    loginError = '';
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (res.ok) {
      token = '';
      await checkSession();
    } else {
      loginError = '令牌无效';
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    role = 'visitor';
  }

  async function loadNodes() {
    const res = await fetch('/api/nodes?status=all&limit=200');
    nodes = (await res.json()).nodes ?? [];
  }

  async function loadQueue() {
    const res = await fetch('/api/admin/moderate?status=pending');
    queue = (await res.json()).events ?? [];
  }

  async function loadStats() {
    const res = await fetch('/api/admin/stats?days=30');
    stats = await res.json();
  }

  $effect(() => {
    if (role !== 'owner') return;
    if (tab === 'content') loadNodes();
    else if (tab === 'moderation') loadQueue();
    else if (tab === 'stats') loadStats();
  });

  function newDraft() {
    draft = {
      id: null,
      type: 'moment',
      slug: '',
      lang: 'en',
      title: '',
      summary: '',
      bodyMd: '',
      status: 'published'
    };
    tagsInput = '';
    featured = false;
    projectStatus = '';
    imagesInput = '';
    website = '';
    github = '';
    previewHtml = '';
  }

  /** @param {any} node */
  function editNode(node) {
    draft = { ...node };
    tagsInput = Array.isArray(node.extra?.tags) ? node.extra.tags.join(', ') : '';
    featured = node.extra?.featured === true;
    projectStatus = node.extra?.status ?? '';
    imagesInput = Array.isArray(node.extra?.images) ? node.extra.images.join('\n') : '';
    website = node.extra?.website ?? '';
    github = node.extra?.github ?? '';
    previewHtml = '';
    showPreview = false;
  }

  function buildExtra() {
    return {
      featured,
      status: projectStatus || null,
      tags: tagsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      images: imagesInput
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      website: website || undefined,
      github: github || undefined
    };
  }

  async function save() {
    if (!draft) return;
    message = '';
    const payload = {
      type: draft.type,
      slug: draft.slug,
      lang: draft.lang,
      title: draft.title,
      summary: draft.summary,
      bodyMd: draft.bodyMd,
      status: draft.status,
      extra: buildExtra()
    };
    const res = draft.id
      ? await fetch(`/api/nodes/${encodeURIComponent(draft.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      : await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      message = `保存失败：${data.error ?? res.status}`;
      return;
    }
    message = '已保存';
    draft = data.node ?? draft;
    await loadNodes();
  }

  /** @param {string} id */
  async function remove(id) {
    if (!confirm('确定删除？')) return;
    await fetch(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    draft = null;
    await loadNodes();
  }

  /** @param {string} eventId @param {string} status */
  async function moderate(eventId, status) {
    await fetch('/api/admin/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, status })
    });
    await loadQueue();
  }

  async function doPreview() {
    if (!draft) return;
    const res = await fetch('/api/admin/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bodyMd: draft.bodyMd })
    });
    previewHtml = (await res.json()).html ?? '';
    showPreview = true;
  }

  /** @param {Event} e */
  async function upload(e) {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) return;
    uploading = true;
    try {
      const form = new FormData();
      form.append('file', file);
      if (draft) form.append('nodeId', draft.id ?? '');
      const res = await fetch('/api/admin/media', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        imagesInput = (imagesInput ? imagesInput + '\n' : '') + data.url;
      } else {
        alert(`上传失败：${data.error ?? res.status}`);
      }
    } finally {
      uploading = false;
      input.value = '';
    }
  }
</script>

<PageLogo href="/" />

<main class="admin">
  <header class="head">
    <h1>内容控制台</h1>
    {#if role === 'owner'}
      <button class="ghost" onclick={logout}>退出</button>
    {/if}
  </header>

  {#if role === 'loading'}
    <p class="muted">…</p>
  {:else if role !== 'owner'}
    <form class="login" onsubmit={login}>
      <p class="muted">输入 ADMIN_TOKEN 登录</p>
      <input type="password" bind:value={token} placeholder="ADMIN_TOKEN" autocomplete="current-password" />
      <button type="submit" disabled={!token}>登录</button>
      {#if loginError}<span class="error">{loginError}</span>{/if}
    </form>
  {:else}
    <nav class="tabs">
      <button class:active={tab === 'content'} onclick={() => (tab = 'content')}>内容</button>
      <button class:active={tab === 'moderation'} onclick={() => (tab = 'moderation')}>审核</button>
      <button class:active={tab === 'stats'} onclick={() => (tab = 'stats')}>统计</button>
    </nav>

    {#if tab === 'content'}
      <div class="layout">
        <aside class="list">
          <button class="primary" onclick={newDraft}>+ 新建</button>
          {#each nodes as node (node.id)}
            <button class="node-item" class:active={draft?.id === node.id} onclick={() => editNode(node)}>
              <span class="node-type">{node.type}</span>
              <span class="node-title">{node.title || node.slug}</span>
              <span class="node-status" class:draft={node.status !== 'published'}>{node.status}</span>
            </button>
          {/each}
        </aside>

        {#if draft}
          <section class="editor">
            <div class="grid">
              <label>类型
                <select bind:value={draft.type}>
                  {#each types as t}<option value={t}>{t}</option>{/each}
                </select>
              </label>
              <label>语言
                <select bind:value={draft.lang}>
                  <option value="en">en</option>
                  <option value="zh">zh</option>
                </select>
              </label>
              <label>状态
                <select bind:value={draft.status}>
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                  <option value="archived">archived</option>
                </select>
              </label>
            </div>
            <label>Slug<input type="text" bind:value={draft.slug} placeholder="my-article" /></label>
            <label>标题<input type="text" bind:value={draft.title} /></label>
            <label>摘要<textarea rows="2" bind:value={draft.summary}></textarea></label>
            <label>正文（Markdown）<textarea rows="14" bind:value={draft.bodyMd}></textarea></label>

            <div class="grid">
              <label>标签（逗号分隔）<input type="text" bind:value={tagsInput} /></label>
              <label>链接 website<input type="text" bind:value={website} /></label>
              <label>仓库 github<input type="text" bind:value={github} /></label>
            </div>

            {#if draft.type === 'project'}
              <label>项目状态
                <select bind:value={projectStatus}>
                  <option value="">（未标注）</option>
                  <option value="active">active</option>
                  <option value="maintained">maintained</option>
                  <option value="archived">archived</option>
                </select>
              </label>
            {/if}

            <label class="check">
              <input type="checkbox" bind:checked={featured} />
              首页精选（Featured on home）
            </label>

            <label>图片（每行一个 URL）
              <textarea rows="3" bind:value={imagesInput}></textarea>
            </label>
            <div class="row">
              <input type="file" accept="image/*" onchange={upload} />
              {#if uploading}<span class="muted">上传中…</span>{/if}
            </div>

            <div class="actions">
              <button class="primary" onclick={save}>保存</button>
              <button class="ghost" onclick={doPreview}>预览</button>
              {#if draft.id}
                <button class="danger" onclick={() => remove(draft.id)}>删除</button>
              {/if}
              {#if message}<span class="muted">{message}</span>{/if}
            </div>

            {#if showPreview}
              <div class="preview">{@html previewHtml}</div>
            {/if}
          </section>
        {:else}
          <p class="muted">选择左侧条目，或新建。</p>
        {/if}
      </div>
    {/if}

    {#if tab === 'moderation'}
      {#if queue.length === 0}
        <p class="muted">没有待审评论。</p>
      {:else}
        <ul class="queue">
          {#each queue as item (item.id)}
            <li>
              <div class="q-meta">
                <span class="node-type">{item.targetType}</span>
                <span class="muted">{item.targetId}</span>
                <time>{item.createdAt}</time>
              </div>
              <div class="q-body">{item.bodyMd}</div>
              <div class="actions">
                <button class="primary" onclick={() => moderate(item.id, 'approved')}>通过</button>
                <button class="ghost" onclick={() => moderate(item.id, 'spam')}>垃圾</button>
                <button class="danger" onclick={() => moderate(item.id, 'deleted')}>删除</button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    {#if tab === 'stats'}
      {#if !stats}
        <p class="muted">…</p>
      {:else}
        <div class="cards">
          <div class="card"><span class="num">{stats.totals.views}</span><span class="lbl">近 {stats.days} 天浏览</span></div>
          <div class="card"><span class="num">{stats.totals.paths}</span><span class="lbl">被访问页面</span></div>
        </div>

        <h2>每日</h2>
        <ul class="bars">
          {#each stats.byDay as d}
            <li><span class="day">{d.day}</span><span class="bar" style={`width:${Math.min(100, d.views)}%`}></span><span class="val">{d.views}</span></li>
          {/each}
        </ul>

        <h2>热门页面</h2>
        <ul class="bars">
          {#each stats.topPaths as p}
            <li><span class="day">{p.path}</span><span class="val">{p.views}</span></li>
          {/each}
        </ul>

        {#if stats.referrers.length > 0}
          <h2>来源</h2>
          <ul class="bars">
            {#each stats.referrers as r}
              <li><span class="day">{r.referrer}</span><span class="val">{r.views}</span></li>
            {/each}
          </ul>
        {/if}
      {/if}
    {/if}
  {/if}
</main>

<style>
  .admin {
    max-width: 1080px;
    margin: 0 auto;
    padding: 110px 24px 120px;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .head h1 {
    font-family: var(--font-serif);
    font-size: 1.8rem;
    margin: 0;
  }

  .muted {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .error {
    color: var(--color-error);
    font-size: 0.85rem;
  }

  .login {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 320px;
  }

  .tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .tabs button {
    padding: 8px 14px;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
  }

  .tabs button.active {
    color: var(--color-bud-deep);
    border-bottom-color: var(--color-bud);
  }

  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 28px;
    align-items: start;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 70vh;
    overflow-y: auto;
  }

  .node-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: center;
    text-align: left;
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--color-on-surface);
  }

  .node-item:hover,
  .node-item.active {
    background: var(--color-surface-container);
  }

  .node-type {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-bud);
  }

  .node-title {
    font-size: 0.88rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-status {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--text-muted);
  }

  .node-status.draft {
    color: var(--color-sprout-deep);
  }

  .editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-ink-faint);
  }

  .check {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-family: var(--font-sans);
    font-size: 0.88rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--color-on-surface);
  }

  .check input {
    width: auto;
  }

  input,
  select,
  textarea {
    font-family: var(--font-sans);
    font-size: 0.9rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--color-on-surface);
    padding: 8px 10px;
    border: 1px solid var(--color-paper-line);
    border-radius: 8px;
    background: var(--color-surface);
  }

  textarea {
    resize: vertical;
    font-family: var(--font-mono);
    line-height: 1.5;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  button {
    font-family: inherit;
    font-size: 0.86rem;
    padding: 8px 16px;
    border-radius: 999px;
    cursor: pointer;
  }

  button.primary {
    background: var(--color-primary);
    color: var(--color-on-primary);
  }

  button.ghost {
    border: 1px solid var(--color-paper-line);
    color: var(--color-on-surface);
  }

  button.danger {
    border: 1px solid var(--color-error);
    color: var(--color-error);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .preview {
    margin-top: 12px;
    padding: 20px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--color-surface-container-low);
    line-height: 1.7;
  }

  .queue {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .queue li {
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
  }

  .q-meta {
    display: flex;
    gap: 10px;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .q-body {
    margin-bottom: 12px;
    white-space: pre-wrap;
  }

  .cards {
    display: flex;
    gap: 16px;
    margin-bottom: 28px;
  }

  .card {
    flex: 1;
    padding: 20px;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .card .num {
    font-family: var(--font-serif);
    font-size: 2rem;
  }

  .card .lbl {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .bars {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bars li {
    display: grid;
    grid-template-columns: 160px 1fr auto;
    gap: 10px;
    align-items: center;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .bars .day {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bars .bar {
    height: 8px;
    border-radius: 4px;
    background: var(--color-bud-soft);
  }

  .bars .val {
    color: var(--color-bud-deep);
  }

  @media (max-width: 760px) {
    .layout,
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
