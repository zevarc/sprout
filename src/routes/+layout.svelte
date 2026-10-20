<script>
  import favicon from '$lib/assets/favicon.svg'
  import '../styles/main.css';
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { setupLightbox } from '$lib/lightbox.js';
  import { setupHighlight } from '$lib/highlight.js';
  import { site } from '$lib/site';
  import { hasFeature } from '$lib/engine/features';
  import { getLink, localeFromPath } from '$lib/i18n/index.js';
  import { publicTypes } from '$lib/content/registry';

  const {children}=$props()

  const htmlLang = $derived(localeFromPath($page.url.pathname));
  const brandCopy = $derived(site.brand[htmlLang] ?? site.brand[site.defaultLocale]);
  // Any `<type>/<slug>` detail page renders its own social card.
  const isPostPage = $derived.by(() => {
    const nonDefault = site.locales.map((l) => l.code).filter((c) => c !== site.defaultLocale);
    let segs = $page.url.pathname.split('/').filter(Boolean);
    if (nonDefault.includes(segs[0])) segs = segs.slice(1);
    return segs.length >= 2 && publicTypes().some((t) => t.route === `/${segs[0]}`);
  });

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = htmlLang;
    }
  });

  // Privacy-preserving pageview beacon (no cookies, no ids).
  $effect(() => {
    const path = $page.url.pathname;
    if (typeof document === 'undefined') return;
    if (!hasFeature('analytics')) return;
    if (path.startsWith('/admin') || path.startsWith('/api') || path.startsWith('/media')) return;
    const payload = JSON.stringify({ path, referrer: document.referrer });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/events/pageview',
        new Blob([payload], { type: 'application/json' })
      );
    } else {
      fetch('/api/events/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  });

  onMount(() => {
    const isZh = () => document.documentElement.lang === 'zh';
    /**
     * @param {boolean} copied
     */
    const copyLabel = (copied) => isZh() ? (copied ? '已复制' : '复制') : (copied ? 'Copied!' : 'Copy');

    // 初始文案按当前语言设置
    document.querySelectorAll('.code-copy').forEach((btn) => {
      btn.textContent = copyLabel(false);
    });

    /**
     * @param {Event} event
     */
    async function handleClick(event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const btn = target.closest('.code-copy');
      if (!btn) return;
      const code = btn.closest('.code-block')?.querySelector('code')?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = copyLabel(true);
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = copyLabel(false);
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        // clipboard unavailable
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  });

  onMount(() => setupLightbox());

  // Highlight code blocks on first load and after every client-side navigation.
  afterNavigate(() => setupHighlight());
</script>

<svelte:head>
		<link rel="icon" href={favicon} type="image/svg+xml" />
		<link rel="alternate" type="application/rss+xml" title={`${site.name} RSS`} href={`/${getLink('feed.xml', htmlLang)}`} />
		{#if !isPostPage}
			<meta property="og:image" content={`${site.url}/og-image.svg`} />
		{/if}
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={site.name} />
		<meta name="twitter:description" content={brandCopy.seoDescription} />
		{#if !isPostPage}
			<meta name="twitter:image" content={`${site.url}/og-image.svg`} />
		{/if}
</svelte:head>

{@render children()}