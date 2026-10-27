<script>
  import { onMount } from 'svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { contentTypes, labelText } from '$lib/content/registry';
  import { content } from '$lib/engine/registry';
  import { initialFieldValues, validateFields } from '$lib/engine/fields';
  import { site } from '$lib/site';
  import { hasFeature } from '$lib/engine/features';

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
  /** 声明字段的当前值（按当前类型的 `fields` 归一化）。 */
  /** @type {Record<string, any>} */
  let fieldValues = $state({});
  let showPreview = $state(false);
  let previewHtml = $state('');

  // 列表筛选
  let search = $state('');
  let typeFilter = $state('');
  let langFilter = $state('');
  let statusFilter = $state('');

  // 编辑安全与工具
  let dirty = $state(false);
  let autoSavedAt = $state('');
  let savedSnapshot = $state('');
  let slugAtLoad = $state('');
  /** @type {string | null} 本地草稿的时间戳 */
  let localHint = $state(null);
  /** @type {string | null} 本地草稿的状态快照 */
  let localJson = null;
  /** @type {HTMLTextAreaElement | null} */
  let bodyEl = $state(null);
  let altInput = $state('');
  let uploading = $state(false);

  const TOOLBAR = [
    { label: 'B', title: '加粗', text: '**粗体**' },
    { label: 'I', title: '斜体', text: '*斜体*' },
    { label: '`', title: '行内代码', text: '`code`' },
    { label: 'H2', title: '二级标题', text: '\n## 标题\n' },
    { label: '链接', title: '链接', text: '[文字](https://)' },
    { label: '代码块', title: '代码块', text: '\n```\n\n```\n' },
    { label: '列表', title: '列表', text: '\n- 条目\n' },
    { label: '引用', title: '引用', text: '\n> 引用\n' }
  ];

  /** @type {any[]} */
  let queue = $state([]);
  /** @type {any} */
  let stats = $state(null);

  // 成员与邀请（features.members 开启时）
  /** @type {any[]} */
  let members = $state([]);
  /** @type {any[]} */
  let invites = $state([]);
  let inviteLabel = $state('');
  let memberMsg = $state('');
  /** @type {string | null} */
  let newInviteUrl = $state(null);

  const types = Object.values(contentTypes).map((t) => t.type);

  const filteredNodes = $derived(
    nodes.filter((n) => {
      if (typeFilter && n.type !== typeFilter) return false;
      if (langFilter && n.lang !== langFilter) return false;
      if (statusFilter && n.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      return !q || `${n.title ?? ''} ${n.slug} ${n.id}`.toLowerCase().includes(q);
    })
  );

  /** @param {string | null | undefined} iso */
  const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

  /** 当前类型声明的字段（编辑器据此渲染，不用按类型写死）。 */
  const fields = $derived(draft ? (contentTypes[draft.type]?.fields ?? []) : []);

  function currentState() {
    return JSON.stringify({
      id: draft?.id ?? null,
      type: draft?.type ?? '',
      slug: draft?.slug ?? '',
      lang: draft?.lang ?? '',
      title: draft?.title ?? '',
      summary: draft?.summary ?? '',
      bodyMd: draft?.bodyMd ?? '',
      status: draft?.status ?? '',
      publishedAt: draft?.publishedAt ?? '',
      occurredAt: draft?.occurredAt ?? '',
      visibility: draft?.visibility ?? '',
      tagsInput,
      fieldValues
    });
  }

  /** 发布前的非阻断检查；保存时若状态是 published 会先确认。 */
  const warnings = $derived.by(() => {
    /** @type {string[]} */
    const out = [];
    if (!draft) return out;
    if (!String(draft.summary ?? '').trim()) out.push('摘要为空（列表与分享卡片会缺描述）');

    const md = String(draft.bodyMd ?? '');
    const imgs = [...md.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
    const noAlt = imgs.filter((m) => !m[1].trim()).length;
    if (noAlt > 0) out.push(`${noAlt} 张图片没有 alt 文本`);

    const levels = [...md.matchAll(/^(#{1,6})\s/gm)].map((m) => m[1].length);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        out.push('正文标题有跳级（例如 h2 直接到 h4）');
        break;
      }
    }

    const dup = nodes.some(
      (n) =>
        n.id !== draft.id &&
        n.type === draft.type &&
        n.lang === draft.lang &&
        n.slug === draft.slug
    );
    if (dup) out.push('同语言下已有相同 slug');

    return out;
  });

  // 媒体面板
  /** @type {any[]} */
  let mediaList = $state([]);
  // 翻译配对
  let linkTarget = $state('');
  /** @type {string | null} */
  let linkedTo = $state(null);
  const linkedNode = $derived(linkedTo ? nodes.find((n) => n.id === linkedTo) : null);
  const linkCandidates = $derived(
    draft ? nodes.filter((n) => n.id !== draft.id && n.type === draft.type) : []
  );
  // 批量操作
  /** @type {Set<string>} */
  let selected = $state(new Set());

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

  async function loadMembers() {
    const res = await fetch('/api/admin/members');
    if (!res.ok) {
      members = [];
      invites = [];
      return;
    }
    const data = await res.json();
    members = data.members ?? [];
    invites = data.invites ?? [];
  }

  async function createInvite() {
    memberMsg = '';
    newInviteUrl = null;
    const res = await fetch('/api/admin/members/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: inviteLabel || null })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      memberMsg = `生成失败：${data.error ?? res.status}`;
      return;
    }
    newInviteUrl = `${location.origin}${data.url}`;
    inviteLabel = '';
    await loadMembers();
  }

  /** @param {string} id */
  async function removeMember(id) {
    if (!confirm('移除这个成员？其登录会话也会失效。')) return;
    await fetch(`/api/admin/members/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadMembers();
  }

  /** @param {string} id */
  async function revokeInvite(id) {
    await fetch(`/api/admin/members/invites/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadMembers();
  }

  $effect(() => {
    if (role !== 'owner') return;
    if (tab === 'content') loadNodes();
    else if (tab === 'moderation') loadQueue();
    else if (tab === 'stats') loadStats();
    else if (tab === 'members') loadMembers();
  });

  /** 上次写作使用的语言：短内容不该每次都被拽回默认语言。 */
  function rememberedLang() {
    try {
      const saved = localStorage.getItem('admin:lang');
      if (saved && site.locales.some((l) => l.code === saved)) return saved;
    } catch {
      /* ignore */
    }
    // 没有记录时，沿用最近编辑过的那条内容的语言。
    const latest = nodes[0]?.lang;
    if (latest && site.locales.some((l) => l.code === latest)) return latest;
    return site.defaultLocale;
  }

  function newDraft() {
    draft = {
      id: null,
      type: 'moment',
      slug: '',
      lang: rememberedLang(),
      title: '',
      summary: '',
      bodyMd: '',
      status: 'published',
      publishedAt: toLocal(new Date().toISOString()),
      occurredAt: '',
      visibility: content.defaultVisibility ?? 'public'
    };
    tagsInput = '';
    fieldValues = initialFieldValues(contentTypes.moment?.fields ?? [], {});
    previewHtml = '';
    showPreview = false;
    slugAtLoad = '';
    savedSnapshot = currentState();
    dirty = false;
    clearLocal();
    mediaList = [];
    linkedTo = null;
    linkTarget = '';
    message = '';
  }

  /** @param {any} node */
  function editNode(node) {
    if (dirty && !confirm('当前草稿未保存，仍要切换吗？')) return;
    draft = { ...node, publishedAt: toLocal(node.publishedAt), occurredAt: toLocal(node.occurredAt) };
    tagsInput = (node.tags ?? []).join(', ');
    fieldValues = initialFieldValues(contentTypes[node.type]?.fields ?? [], node.fields ?? {});
    previewHtml = '';
    showPreview = false;
    slugAtLoad = node.slug ?? '';
    savedSnapshot = currentState();
    dirty = false;
    clearLocal();
    message = '';
    mediaList = [];
    linkedTo = null;
    linkTarget = '';
    if (draft.id) {
      void loadMedia();
      void loadLink();
    }

    // 有未写回的本地自动保存时，给出提示而不是静默覆盖。
    try {
      const stored = localStorage.getItem(autosaveKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state && parsed.state !== currentState()) {
          localJson = parsed.state;
          localHint = parsed.at ?? '';
        }
      }
    } catch {
      /* ignore malformed autosave */
    }
  }

  function autosaveKey() {
    return `admin:draft:${draft?.id ?? 'new'}`;
  }

  function clearLocal() {
    localHint = null;
    localJson = null;
    autoSavedAt = '';
  }

  function restoreLocal() {
    if (!localJson) return;
    const s = JSON.parse(localJson);
    draft.type = s.type;
    draft.slug = s.slug;
    draft.lang = s.lang;
    draft.title = s.title;
    draft.summary = s.summary;
    draft.bodyMd = s.bodyMd;
    draft.status = s.status;
    draft.publishedAt = s.publishedAt;
    draft.occurredAt = s.occurredAt;
    draft.visibility = s.visibility;
    tagsInput = s.tagsInput;
    fieldValues = s.fieldValues ?? {};
    localHint = null;
    localJson = null;
    message = '已恢复本地草稿';
  }

  function discardLocal() {
    localStorage.removeItem(autosaveKey());
    clearLocal();
  }

  async function save() {
    if (!draft) return;
    message = '';

    if (draft.id && slugAtLoad && draft.slug !== slugAtLoad && draft.status === 'published') {
      const ok = confirm(
        `slug 从「${slugAtLoad}」改成「${draft.slug}」。已发布的外链会 404，确定保存？`
      );
      if (!ok) return;
    }

    if (draft.status === 'published' && warnings.length > 0) {
      const ok = confirm(`发布前检查：\n\n· ${warnings.join('\n· ')}\n\n仍然发布？`);
      if (!ok) return;
    }

    // 与后端同一套规则；后端仍是权威（前端可绕过，写入边界不可绕过）。
    const checked = validateFields(fields, fieldValues);
    if (!checked.ok) {
      message = `字段有问题：${checked.errors.join('；')}`;
      return;
    }

    const payload = {
      type: draft.type,
      slug: draft.slug,
      lang: draft.lang,
      title: draft.title,
      summary: draft.summary,
      bodyMd: draft.bodyMd,
      status: draft.status,
      publishedAt: draft.publishedAt ? new Date(draft.publishedAt).toISOString() : null,
      occurredAt: draft.occurredAt ? new Date(draft.occurredAt).toISOString() : null,
      visibility: draft.visibility,
      tags: tagsInput,
      fields: checked.value
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
    const node = data.node ?? draft;
    draft = { ...node, publishedAt: toLocal(node.publishedAt), occurredAt: toLocal(node.occurredAt) };
    tagsInput = (node.tags ?? []).join(', ');
    fieldValues = initialFieldValues(fields, node.fields ?? {});
    slugAtLoad = draft.slug;
    savedSnapshot = currentState();
    dirty = false;
    localStorage.removeItem('admin:draft:new');
    if (draft.id) localStorage.removeItem(`admin:draft:${draft.id}`);
    clearLocal();
    await loadNodes();
  }

  /** @param {string} id */
  async function remove(id) {
    if (!confirm('确定删除？')) return;
    await fetch(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    localStorage.removeItem(`admin:draft:${id}`);
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

  /** 在正文光标处插入一段 Markdown。 */
  /** @param {string} text */
  function insertAtCursor(text) {
    if (!draft) return;
    if (!bodyEl) {
      draft.bodyMd = `${draft.bodyMd ?? ''}${text}`;
      return;
    }
    const start = bodyEl.selectionStart ?? bodyEl.value.length;
    const end = bodyEl.selectionEnd ?? start;
    const value = bodyEl.value;
    draft.bodyMd = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length;
    requestAnimationFrame(() => {
      bodyEl?.focus();
      bodyEl?.setSelectionRange(caret, caret);
    });
  }

  /** @param {KeyboardEvent} e */
  function onKeydown(e) {
    if (!draft) return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    } else if (meta && e.key === 'Enter') {
      e.preventDefault();
      doPreview();
    }
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
      if (draft) form.append('assetId', draft.id ?? '');
      form.append('alt', altInput.trim());
      const res = await fetch('/api/admin/media', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        insertAtCursor(`![${altInput.trim()}](${data.url})`);
        altInput = '';
        void loadMedia();
      } else {
        alert(`上传失败：${data.error ?? res.status}`);
      }
    } finally {
      uploading = false;
      input.value = '';
    }
  }

  // ---- 媒体面板 ----
  async function loadMedia() {
    if (!draft?.id) {
      mediaList = [];
      return;
    }
    const res = await fetch(`/api/admin/media?assetId=${encodeURIComponent(draft.id)}`);
    mediaList = res.ok ? ((await res.json()).media ?? []) : [];
  }

  /** @param {any} item @param {string} alt */
  async function updateMediaAlt(item, alt) {
    if (alt === (item.alt ?? '')) return;
    await fetch('/api/admin/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: draft.id, id: item.id, alt })
    });
    await loadMedia();
  }

  /** @param {number} index @param {number} delta */
  async function moveMedia(index, delta) {
    const a = mediaList[index];
    const b = mediaList[index + delta];
    if (!a || !b) return;
    await Promise.all([
      fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: draft.id, id: a.id, position: index + delta })
      }),
      fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: draft.id, id: b.id, position: index })
      })
    ]);
    await loadMedia();
  }

  /** @param {any} item */
  async function removeMedia(item) {
    if (!confirm('删除这个媒体？不再被引用时存储对象也会被删除。')) return;
    await fetch(
      `/api/admin/media?assetId=${encodeURIComponent(draft.id)}&id=${encodeURIComponent(item.id)}`,
      { method: 'DELETE' }
    );
    await loadMedia();
  }

  /**
   * 设为封面：封面是"这次使用"的属性，一个内容只能有一个。先清掉旧的再设新的。
   * @param {any} item
   */
  async function setCover(item) {
    const current = mediaList.find((m) => m.role === 'cover');
    if (current && current.id !== item.id) {
      await fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: draft.id, id: current.id, role: 'body' })
      });
    }
    await fetch('/api/admin/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: draft.id, id: item.id, role: 'cover' })
    });
    await loadMedia();
  }

  // ---- 翻译配对 ----
  async function loadLink() {
    if (!draft?.id) {
      linkedTo = null;
      return;
    }
    const res = await fetch(`/api/admin/link?id=${encodeURIComponent(draft.id)}`);
    const data = res.ok ? await res.json() : { ids: [] };
    linkedTo = data.ids?.[0] ?? null;
  }

  async function linkTranslation() {
    if (!draft?.id || !linkTarget) return;
    const res = await fetch('/api/admin/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draft.id, otherId: linkTarget })
    });
    if (!res.ok) {
      message = '关联失败';
      return;
    }
    linkTarget = '';
    message = '已关联译文';
    await loadLink();
  }

  async function unlinkTranslation() {
    if (!draft?.id || !linkedTo) return;
    await fetch(
      `/api/admin/link?id=${encodeURIComponent(draft.id)}&otherId=${encodeURIComponent(linkedTo)}`,
      { method: 'DELETE' }
    );
    linkedTo = null;
    await loadLink();
  }

  // ---- 批量操作 ----
  /** @param {string} id */
  function toggleSelect(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  /** @param {string} status */
  async function bulkStatus(status) {
    if (selected.size === 0) return;
    if (!confirm(`把选中的 ${selected.size} 个节点设为 ${status}？`)) return;
    for (const id of selected) {
      await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    }
    selected = new Set();
    await loadNodes();
  }

  // 记住上次写作使用的语言（下次「新建」沿用它）。
  $effect(() => {
    const lang = draft?.lang;
    if (!lang) return;
    try {
      localStorage.setItem('admin:lang', lang);
    } catch {
      /* ignore */
    }
  });

  // 脏标记：和载入时的快照比较
  $effect(() => {
    const state = currentState();
    if (savedSnapshot) dirty = state !== savedSnapshot;
  });

  // 自动保存到 localStorage（防刷新丢稿）
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let autosaveTimer;
  $effect(() => {
    if (role !== 'owner' || !draft || !dirty) return;
    const state = currentState();
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const at = new Date().toLocaleTimeString();
      localStorage.setItem(autosaveKey(), JSON.stringify({ state, at }));
      autoSavedAt = at;
    }, 800);
  });

  // 分屏预览：正文变化后自动刷新
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let previewTimer;
  $effect(() => {
    if (!showPreview || !draft) return;
    const md = draft.bodyMd;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      void md;
      doPreview();
    }, 600);
  });

  // 离开页面前提醒未保存
  $effect(() => {
    if (typeof window === 'undefined') return;
    const handler = (/** @type {BeforeUnloadEvent} */ e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  });
</script>

<PageLogo href="/" />
<svelte:window onkeydown={onKeydown} />

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
      <label class="muted" for="admin-token">输入 ADMIN_TOKEN 登录</label>
      <input
        id="admin-token"
        type="password"
        bind:value={token}
        placeholder="ADMIN_TOKEN"
        autocomplete="current-password"
      />
      <button type="submit" disabled={!token}>登录</button>
      {#if loginError}<span class="error">{loginError}</span>{/if}
    </form>
  {:else}
    <nav class="tabs">
      <button class:active={tab === 'content'} onclick={() => (tab = 'content')}>内容</button>
      <button class:active={tab === 'moderation'} onclick={() => (tab = 'moderation')}>审核</button>
      <button class:active={tab === 'stats'} onclick={() => (tab = 'stats')}>统计</button>
      {#if hasFeature('members')}
        <button class:active={tab === 'members'} onclick={() => (tab = 'members')}>成员</button>
      {/if}
    </nav>

    {#if tab === 'content'}
      <div class="layout">
        <aside class="list">
          <button class="primary" onclick={newDraft}>+ 新建</button>

          <div class="filters">
            <input type="search" placeholder="搜索标题 / slug" bind:value={search} />
            <div class="filter-row">
              <select bind:value={typeFilter} aria-label="类型">
                <option value="">全部类型</option>
                {#each types as t}<option value={t}>{t}</option>{/each}
              </select>
              <select bind:value={langFilter} aria-label="语言">
                <option value="">全部语言</option>
                {#each site.locales as loc}<option value={loc.code}>{loc.code}</option>{/each}
              </select>
              <select bind:value={statusFilter} aria-label="状态">
                <option value="">全部状态</option>
                <option value="published">published</option>
                <option value="draft">draft</option>
                <option value="archived">archived</option>
              </select>
            </div>
            <span class="muted">{filteredNodes.length} / {nodes.length}</span>
          </div>

          {#if selected.size > 0}
            <div class="bulk">
              <span>已选 {selected.size}</span>
              <button class="ghost" onclick={() => bulkStatus('published')}>发布</button>
              <button class="ghost" onclick={() => bulkStatus('archived')}>下架</button>
              <button class="ghost" onclick={() => (selected = new Set())}>取消</button>
            </div>
          {/if}

          {#each filteredNodes as node (node.id)}
            <div class="node-row">
              <input
                type="checkbox"
                checked={selected.has(node.id)}
                onchange={() => toggleSelect(node.id)}
                aria-label="选择节点"
              />
              <button class="node-item" class:active={draft?.id === node.id} onclick={() => editNode(node)}>
                <span class="node-type">{node.type}</span>
                <span class="node-title">{node.title || node.slug}</span>
                <span class="node-status" class:draft={node.status !== 'published'}>{node.status}</span>
              </button>
            </div>
          {/each}
        </aside>

        {#if draft}
          <section class="editor" class:split={showPreview}>
            {#if localHint}
              <div class="notice">
                <span>检测到本地自动保存的草稿（{localHint}）</span>
                <button class="ghost" onclick={restoreLocal}>恢复</button>
                <button class="ghost" onclick={discardLocal}>丢弃</button>
              </div>
            {/if}

            <div class="editor-body">
              <div class="fields">
                <div class="grid">
                  <label>类型
                    <select bind:value={draft.type}>
                      {#each types as t}<option value={t}>{t}</option>{/each}
                    </select>
                  </label>
                  <label>语言
                    <select bind:value={draft.lang}>
                      {#each site.locales as loc}<option value={loc.code}>{loc.code}</option>{/each}
                    </select>
                  </label>
                  <label>状态
                    <select bind:value={draft.status}>
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                      <option value="archived">archived</option>
                    </select>
                  </label>
                  <label>发布日期
                    <input type="datetime-local" bind:value={draft.publishedAt} />
                  </label>
                  <label>发生时间（可选）
                    <input type="datetime-local" bind:value={draft.occurredAt} />
                  </label>
                  <label>可见性
                    <select bind:value={draft.visibility}>
                      <option value="public">public</option>
                      <option value="private">private</option>
                    </select>
                  </label>
                </div>
                <label>Slug<input type="text" bind:value={draft.slug} placeholder="留空自动生成（标题或日期）" /></label>
                <label>标题<input type="text" bind:value={draft.title} /></label>
                <label>摘要<textarea rows="2" bind:value={draft.summary}></textarea></label>

                <div class="body-label">
                  <span>正文（Markdown）</span>
                  <span class="hint">⌘/Ctrl+S 保存 · ⌘/Ctrl+Enter 预览</span>
                </div>
                <div class="toolbar">
                  {#each TOOLBAR as item}
                    <button
                      type="button"
                      class="ghost"
                      title={item.title}
                      onclick={() => insertAtCursor(item.text)}
                    >{item.label}</button>
                  {/each}
                </div>
                <textarea rows="18" bind:this={bodyEl} bind:value={draft.bodyMd}></textarea>

                <div class="grid">
                  <label>标签（逗号分隔）<input type="text" bind:value={tagsInput} /></label>
                </div>

                {#each fields as field (field.key)}
                  {#if field.type === 'boolean'}
                    <label class="check">
                      <input
                        type="checkbox"
                        checked={fieldValues[field.key] === true}
                        onchange={(e) => (fieldValues[field.key] = e.currentTarget.checked)}
                      />
                      {labelText(field.label, draft.lang, field.key)}
                    </label>
                  {:else}
                    <label>
                      {labelText(field.label, draft.lang, field.key)}
                      {#if field.type === 'select'}
                        <select
                          value={fieldValues[field.key] ?? ''}
                          onchange={(e) => (fieldValues[field.key] = e.currentTarget.value || '')}
                        >
                          <option value="">（未标注）</option>
                          {#each field.options ?? [] as opt}
                            <option value={opt.value}>{labelText(opt.label, draft.lang, opt.value)}</option>
                          {/each}
                        </select>
                      {:else if field.type === 'tags'}
                        <input
                          type="text"
                          placeholder="逗号分隔"
                          value={Array.isArray(fieldValues[field.key])
                            ? fieldValues[field.key].join(', ')
                            : ''}
                          oninput={(e) =>
                            (fieldValues[field.key] = e.currentTarget.value
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean))}
                        />
                      {:else if field.type === 'textarea' || field.type === 'markdown'}
                        <textarea
                          rows={field.type === 'markdown' ? 6 : 3}
                          value={fieldValues[field.key] ?? ''}
                          oninput={(e) => (fieldValues[field.key] = e.currentTarget.value)}
                        ></textarea>
                      {:else}
                        <input
                          type={field.type === 'number'
                            ? 'number'
                            : field.type === 'url'
                              ? 'url'
                              : field.type === 'date'
                                ? 'date'
                                : 'text'}
                          value={fieldValues[field.key] ?? ''}
                          oninput={(e) =>
                            (fieldValues[field.key] =
                              field.type === 'number'
                                ? e.currentTarget.value === ''
                                  ? ''
                                  : Number(e.currentTarget.value)
                                : e.currentTarget.value)}
                        />
                      {/if}
                    </label>
                  {/if}
                {/each}

                <div class="upload-row">
                  <input type="text" bind:value={altInput} placeholder="图片 alt（插入正文用）" />
                  <input type="file" accept="image/*" onchange={upload} />
                  {#if uploading}<span class="muted">上传中…</span>{/if}
                </div>

                {#if draft.id}
                  <div class="media-panel">
                    <div class="body-label">
                      <span>媒体</span><span class="hint">{mediaList.length} 个</span>
                    </div>
                    {#if mediaList.length === 0}
                      <p class="muted">还没有媒体。上传后会插入正文并出现在这里。</p>
                    {:else}
                      <ul class="media-list">
                        {#each mediaList as item, index (item.id)}
                          <li>
                            <img src={item.url} alt={item.alt ?? ''} width="48" height="48" loading="lazy" />
                            <input
                              type="text"
                              value={item.alt ?? ''}
                              placeholder="alt"
                              onchange={(e) => updateMediaAlt(item, e.currentTarget.value)}
                            />
                            <button
                              class="ghost"
                              onclick={() => moveMedia(index, -1)}
                              disabled={index === 0}
                              aria-label="上移"
                            >↑</button>
                            <button
                              class="ghost"
                              onclick={() => moveMedia(index, 1)}
                              disabled={index === mediaList.length - 1}
                              aria-label="下移"
                            >↓</button>
                            <button
                              class="ghost"
                              onclick={() => setCover(item)}
                              disabled={item.role === 'cover'}
                            >{item.role === 'cover' ? '封面' : '设为封面'}</button>
                            <button class="danger" onclick={() => removeMedia(item)}>删除</button>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>

                  <div class="link-panel">
                    <div class="body-label"><span>翻译配对</span></div>
                    {#if linkedTo}
                      <p class="muted">
                        已关联「{linkedNode?.title || linkedNode?.slug || linkedTo}」
                        <button class="ghost" onclick={unlinkTranslation}>解除</button>
                      </p>
                    {:else}
                      <div class="link-row">
                        <select bind:value={linkTarget}>
                          <option value="">选择另一语言的同类型节点…</option>
                          {#each linkCandidates as n (n.id)}
                            <option value={n.id}>{n.lang} · {n.title || n.slug}</option>
                          {/each}
                        </select>
                        <button class="ghost" onclick={linkTranslation} disabled={!linkTarget}>关联</button>
                      </div>
                    {/if}
                  </div>
                {/if}

                {#if warnings.length > 0}
                  <ul class="warnings">
                    {#each warnings as warning}<li>{warning}</li>{/each}
                  </ul>
                {/if}

                <div class="actions">
                  <button class="primary" onclick={save}>保存</button>
                  <button class="ghost" onclick={doPreview}>预览</button>
                  {#if draft.id}
                    <button class="danger" onclick={() => remove(draft.id)}>删除</button>
                  {/if}
                  {#if dirty}
                    <span class="dirty">未保存{autoSavedAt ? ` · 已自动保存 ${autoSavedAt}` : ''}</span>
                  {:else if message}
                    <span class="muted">{message}</span>
                  {/if}
                </div>
              </div>

              {#if showPreview}
                <div class="preview">{@html previewHtml}</div>
              {/if}
            </div>
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

    {#if tab === 'members' && hasFeature('members')}
      <section class="members">
        <div class="member-add">
          <input type="text" bind:value={inviteLabel} placeholder="成员称呼（可选）" />
          <button class="primary" onclick={createInvite}>生成邀请链接</button>
        </div>
        {#if memberMsg}<p class="error">{memberMsg}</p>{/if}
        {#if newInviteUrl}
          <p class="muted">邀请链接（单次有效，14 天）：<code>{newInviteUrl}</code></p>
        {/if}

        <h2>成员</h2>
        {#if members.length === 0}
          <p class="muted">还没有成员。</p>
        {:else}
          <ul class="queue">
            {#each members as m (m.id)}
              <li>
                <div class="q-meta">
                  <span class="node-type">{m.name}</span>
                  <time>{m.createdAt}</time>
                </div>
                <div class="actions">
                  <button class="danger" onclick={() => removeMember(m.id)}>移除</button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}

        <h2>邀请</h2>
        {#if invites.length === 0}
          <p class="muted">还没有邀请。</p>
        {:else}
          <ul class="queue">
            {#each invites as i (i.id)}
              <li>
                <div class="q-meta">
                  <span class="node-type">{i.label ?? '（未命名）'}</span>
                  <span class="muted">{i.acceptedAt ? '已使用' : `有效期至 ${i.expiresAt}`}</span>
                </div>
                {#if !i.acceptedAt}
                  <div class="actions">
                    <button class="ghost" onclick={() => revokeInvite(i.id)}>撤销</button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
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

  @media (max-width: 760px), (pointer: coarse) {
    /* iOS Safari zooms on focus below 16px. */
    input,
    select,
    textarea {
      font-size: 1rem;
    }
    .layout,
    .grid {
      grid-template-columns: 1fr;
    }
  }

  /* ---- 编辑器增强 ---- */
  .filters {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0 10px;
  }

  .filter-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .filters input,
  .filters select {
    font-size: 0.78rem;
    padding: 6px 8px;
  }

  .editor-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .editor.split .editor-body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .body-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .body-label .hint {
    text-transform: none;
    letter-spacing: 0;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: -4px 0 2px;
  }

  .toolbar button {
    padding: 4px 9px;
    font-size: 0.74rem;
  }

  .upload-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .upload-row input[type='text'] {
    flex: 1 1 220px;
  }

  .warnings {
    margin: 0;
    padding: 10px 12px 10px 28px;
    border: 1px solid var(--color-paper-line);
    border-radius: 10px;
    background: var(--color-bud-pale);
    color: var(--color-bud-deep);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .dirty {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--color-sprout-deep);
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px 12px;
    border: 1px solid var(--color-paper-line);
    border-radius: 10px;
    background: var(--color-surface-container-low);
    font-size: 0.82rem;
  }

  .preview {
    margin-top: 0;
    max-height: 78vh;
    overflow: auto;
  }

  @media (max-width: 1100px) {
    .editor.split .editor-body {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .node-row {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 6px;
    align-items: center;
  }

  .node-row input[type='checkbox'] {
    accent-color: var(--color-bud);
    margin: 0;
  }

  .bulk {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 8px 10px;
    border: 1px solid var(--color-paper-line);
    border-radius: 10px;
    background: var(--color-bud-pale);
    color: var(--color-bud-deep);
    font-size: 0.8rem;
  }

  .bulk button {
    padding: 4px 10px;
    font-size: 0.72rem;
  }

  .media-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .media-list li {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto auto auto;
    gap: 8px;
    align-items: center;
  }

  .media-list img {
    border-radius: 8px;
    border: 1px solid var(--color-paper-line);
    object-fit: cover;
  }

  .media-list input {
    font-size: 0.78rem;
    padding: 6px 8px;
  }

  .media-list button {
    padding: 4px 9px;
    font-size: 0.72rem;
  }

  .link-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .link-row select {
    flex: 1 1 240px;
  }

  .link-row button {
    padding: 4px 10px;
    font-size: 0.74rem;
  }

  .member-add {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }

  .member-add input {
    flex: 1 1 220px;
  }

  .members code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    word-break: break-all;
  }
@media (max-width: 1024px), (pointer: coarse) {
  /* Same specificity as `.filters input` / `.media-list input`, but later:
     iOS Safari zooms the viewport when a control below 16px is focused. */
  .admin input,
  .admin select,
  .admin textarea {
    font-size: 1rem;
  }
}
</style>
