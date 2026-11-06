<script>
  import favicon from '$lib/assets/favicon.svg'
  // Preload the two faces the first screen actually needs. `@font-face` URLs are
  // only discovered once the stylesheet is parsed, which serialises an extra
  // round trip: measured on 4G the hero sat in Georgia for ~0.95s before
  // Fraunces arrived. Italic + JetBrains Mono stay request-on-use (they are
  // not on the first screen), so this is not a "preload everything" entry.
  import frauncesLatin from '$lib/assets/fonts/fraunces-latin.woff2?url'
  import interLatin from '$lib/assets/fonts/inter-latin.woff2?url'
  import '../styles/main.css';
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { setupLightbox } from '$lib/lightbox.js';
  import { setupHighlight } from '$lib/highlight.js';
  import { site } from '$lib/site';
  import { hasFeature } from '$lib/engine/features';
  import { dirFor, getDictionary, getLink, localeFromPath } from '$lib/i18n/index.js';
  import { publicTypes } from '$lib/content/registry';
  import { shareImage } from '$lib/seo';

  const {children}=$props()

  const htmlLang = $derived(localeFromPath($page.url.pathname));
  const t = $derived(getDictionary(htmlLang));
  const brandCopy = $derived(site.brand[htmlLang] ?? site.brand[site.defaultLocale]);
  // 分享卡：社交平台不吃 SVG，用站点的 PNG（site.config 的 ogImage）。
  const share = shareImage(site.name);
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
      document.documentElement.dir = dirFor(htmlLang);
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
    const t = getDictionary(document.documentElement.lang);
    /**
     * The button is icon-only so the server can emit it without knowing the
     * locale; the label lives in `aria-label`/`title` and is applied here.
     * @param {Element} btn
     * @param {boolean} copied
     */
    const relabel = (btn, copied) => {
      const label = copied ? t.posts.copiedCode : t.posts.copyCode;
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    };

    document.querySelectorAll('.code-copy').forEach((btn) => relabel(btn, false));

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
        relabel(btn, true);
        btn.classList.add('copied');
        setTimeout(() => {
          relabel(btn, false);
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
		<link rel="preload" href={frauncesLatin} as="font" type="font/woff2" crossorigin="anonymous" />
		<link rel="preload" href={interLatin} as="font" type="font/woff2" crossorigin="anonymous" />
		{#if site.logo}
			<link rel="apple-touch-icon" href={site.logo} />
		{/if}
		<link rel="alternate" type="application/rss+xml" title={`${site.name} RSS`} href={`/${getLink('feed.xml', htmlLang)}`} />
		<meta property="og:site_name" content={site.name} />
		{#if !isPostPage}
			<meta property="og:image" content={share.url} />
			<meta property="og:image:width" content={String(share.width)} />
			<meta property="og:image:height" content={String(share.height)} />
			<meta property="og:image:alt" content={share.alt} />
		{/if}
		<meta name="twitter:card" content="summary_large_image" />
		{#if !isPostPage}
			<meta name="twitter:title" content={site.name} />
			<meta name="twitter:description" content={brandCopy.seoDescription} />
			<meta name="twitter:image" content={share.url} />
			<meta name="twitter:image:alt" content={share.alt} />
		{/if}
</svelte:head>

<!-- First tab stop on every page: fixed chrome (logo, language switch) would
     otherwise force keyboard users to tab through the entire head of each page.
     Targets the `#main` landmark each page shell declares. -->
<a class="skip-link" href="#main">{t.common.skipToContent}</a>

{@render children()}

<style>
  .skip-link {
    position: fixed;
    top: 0;
    left: 50%;
    z-index: 2000;
    padding: 10px 18px;
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    background: var(--color-action-bg);
    color: var(--color-action-ink);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    border: none;
    /* Off-screen instead of `display: none`, so it stays focusable. */
    transform: translate(-50%, -120%);
    transition: transform var(--dur-fast) var(--ease-out);
  }

  .skip-link:focus-visible {
    transform: translate(-50%, 0);
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .skip-link {
      transition: none;
    }
  }
</style>