<script>
    import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
    import PageLogo from '$lib/components/PageLogo.svelte';
    import Arc from '$lib/components/visuals/Arc.svelte';
    import CommentSection from '$lib/components/comments/CommentSection.svelte';
    import { onMount } from 'svelte';
    import { formatDate, getDictionary, getLink, homePath as localeHome } from '$lib/i18n/index.js';
    import { site } from '$lib/site';
    import { hasFeature } from '$lib/engine/features';
    import { getContentType } from '$lib/content/registry';
    import { breadcrumbJsonLd, pageTitle, shareImage } from '$lib/seo';

    const { post, related = [], comments = true, translations = [] } = $props();

    let progress = $state(0);
    let activeId = $state('');

    const lang = $derived(post.lng);
    const t = $derived(getDictionary(lang));
    const tocLabel = $derived(t.posts.toc);
    const relatedLabel = $derived(t.posts.related);
    // Social cards must be raster: platforms ignore SVG, so the share image is
    // the site's PNG (`site.ogImage`) rather than a per-article SVG.
    const share = $derived(shareImage(post.title));
    /** @type {import('$lib/reading').TocItem[]} */
    const headings = $derived((post.headings ?? []).filter((/** @type {import('$lib/reading').TocItem} */ h) => h.level <= 4));

    function updateProgress() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      progress = scrollable > 0 ? Math.min(1, doc.scrollTop / scrollable) : 0;
    }

    onMount(() => {
      updateProgress();
      updateActiveHeading();
    });

    function handleScroll() {
      updateProgress();
      updateActiveHeading();
    }

    /**
     * Highlights the last heading whose top has scrolled past the nav
     * (i.e. the section the reader is currently in).
     */
    function updateActiveHeading() {
      const THRESHOLD = 120; // nav height + breathing room
      let current = '';
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= THRESHOLD) {
          current = h.id;
        } else {
          break; // headings are in document order
        }
      }
      if (current) activeId = current;
    }

    /**
     * @param {string} id
     */
    function scrollToHeading(id) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // 同步地址栏 hash（不触发滚动、不产生历史记录）
      const url = new URL(window.location.href);
      if (url.hash !== `#${id}`) {
        url.hash = id;
        history.replaceState(null, '', url);
      }
      activeId = id;
    }

    // Alternates come from the node's group (`group_id`), not from this URL, so a
    // translation may use a different slug and is still linked correctly.
    const homeLink = $derived(localeHome(lang));
    const defaultAlt = $derived(translations.find((t) => t.lang === site.defaultLocale));
    const switcherLinks = $derived(
      Object.fromEntries(translations.map((t) => [t.lang, `/${t.url}`]))
    );

    const articleJson = $derived(
        JSON.stringify(post.jsonLd)
            .replace(/&/g, '\\u0026')
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
    );

    const crumbJson = $derived(
        JSON.stringify(
            breadcrumbJsonLd([
                { name: site.name, url: `${site.url}${localeHome(lang)}` },
                {
                    name: getContentType(post.type)?.label?.[lang] ?? post.type,
                    url: `${site.url}/${getLink(getContentType(post.type)?.route?.replace(/^\//, '') ?? post.type, lang)}`
                },
                { name: post.title, url: `${site.url}/${post.url}` }
            ])
        ).replace(/</g, '\\u003c')
    );
</script>

<svelte:head>
    <title>{pageTitle(post.title)}</title>
    <meta name="description" content={post.description} />
    <meta property="og:title" content={post.title} />
    <meta property="og:description" content={post.description} />
    <meta property="og:type" content="article" />
    <meta property="og:image" content={share.url} />
    <meta property="og:image:width" content={String(share.width)} />
    <meta property="og:image:height" content={String(share.height)} />
    <meta property="og:image:alt" content={share.alt} />
    <meta name="twitter:image" content={share.url} />
    <meta name="twitter:image:alt" content={share.alt} />
    <meta property="og:url" content={`${site.url}/${post.url}`} />
    <link rel="canonical" href={`${site.url}/${post.url}`} />
    {#if site.locales.length > 1 && translations.length > 0}
        {#each translations as alt}
            <link rel="alternate" hreflang={alt.lang} href={`${site.url}/${alt.url}`} />
        {/each}
        {#if defaultAlt}
            <link rel="alternate" hreflang="x-default" href={`${site.url}/${defaultAlt.url}`} />
        {/if}
    {/if}
    {@html `<script type="application/ld+json">${articleJson}</script>`}
    {@html `<script type="application/ld+json">${crumbJson}</script>`}
</svelte:head>

<svelte:window onscroll={handleScroll} />

<div class="reading-progress" style={`transform: scaleX(${progress})`} aria-hidden="true"></div>

<LanguageSwitcher links={switcherLinks} />

<PageLogo href={homeLink} />

{#if headings.length > 0}
  <details class="toc-mobile">
    <summary>{tocLabel}</summary>
    <ul>
      {#each headings as h}
        <li class:sub={h.level > 2}>
          <a href={`#${h.id}`} class:active={h.id === activeId} onclick={(e) => { e.preventDefault(); scrollToHeading(h.id); }}>{h.text}</a>
        </li>
      {/each}
    </ul>
  </details>
{/if}

<div class="post-layout">
  <article class="post-article">
    <header class="post-header">
        <div class="post-watermark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <defs>
              <linearGradient id="post-grad" x1="0" y1="1" x2="0.45" y2="0">
                <stop offset="0%" stop-color="var(--grad-bud-a)" />
                <stop offset="55%" stop-color="var(--grad-bud-b)" />
                <stop offset="100%" stop-color="var(--grad-bud-c)" />
              </linearGradient>
            </defs>
            <path
              d="m 7.7915687,21.187121 c -2.165092,-0.244068 -3.830287,-1.277655 -4.939085,-3.065689 -0.754217,-1.21624 -1.039193,-2.943583 -0.728762,-4.417303 0.458748,-2.177836 1.90419,-3.7857163 4.110442,-4.5723732 0.646862,-0.230644 0.736367,-0.235037 5.3888013,-0.264503 3.226852,-0.02044 4.731014,0.0035 4.731014,0.07527 0,0.05788 -1.434594,1.2529962 -3.187987,2.6558112 -1.983739,1.587105 -3.152147,2.586411 -3.093109,2.645449 0.155939,0.15594 5.790281,0.0058 6.676721,-0.177886 0.872069,-0.180734 1.860728,-0.618482 2.429913,-1.075892 0.528547,-0.424751 1.17931,-1.36539 1.446824,-2.091296 0.316697,-0.859367 0.314615,-2.4579732 -0.0044,-3.3869452 -0.605911,-1.764353 -1.801259,-2.831745 -3.721076,-3.322751 -1.062792,-0.271817 -3.221534,-0.277609 -4.240607,-0.01138 -1.38588,0.362059 -2.9743383,1.144851 -4.1469833,2.043634 -0.358925,0.275101 -0.677011,0.500183 -0.706859,0.500183 -0.318269,0 0.795456,-1.287967 1.801882,-2.083786 0.9801933,-0.775076 2.1435003,-1.372752 3.2543573,-1.672003 0.634,-0.170792 1.09491,-0.217999 2.125161,-0.217659 3.027867,10e-4 4.875739,0.959253 6.26313,3.247886 0.655203,1.08082 0.923312,2.883432 0.632136,4.2501172 -0.4103,1.925804 -1.44525,3.284562 -3.157621,4.145559 -1.116912,0.561594 -1.79428,0.638027 -6.221139,0.701985 -3.8294183,0.05533 -4.7521743,0.02226 -4.7521743,-0.170296 0,-0.048 1.412001,-1.216008 3.1377803,-2.59557 1.961688,-1.568144 3.102072,-2.5440033 3.04251,-2.6035643 -0.15632,-0.156321 -5.7888573,-0.0066 -6.6771133,0.177494 -1.453996,0.3013363 -2.519285,0.9544773 -3.245608,1.9899223 -1.699621,2.422976 -0.849827,6.082015 1.712973,7.375713 1.043991,0.527004 1.963863,0.711161 3.552297,0.711161 1.6602403,0 2.5807283,-0.22106 4.1948573,-1.007416 0.864942,-0.421374 1.351776,-0.730681 2.711048,-1.72245 0.196699,-0.143518 0.199566,-0.139591 0.07389,0.101198 -0.465987,0.892799 -2.183318,2.384664 -3.489366,3.031252 -1.47248,0.728984 -3.1895093,1.007268 -4.9738343,0.806122 z"
              fill="url(#post-grad)"
            />
          </svg>
        </div>
        <p class="post-kicker">{t.nav.posts}</p>
        <h1>{post.title}</h1>
        <div class="post-meta">
            <span class="post-date">{formatDate(post.occurredAt ?? post.date, lang)}</span>
            {#if post.readTime}
                <span class="post-time">{post.readTime} {t.posts.readTime}</span>
            {/if}
            {#if post.updated && post.updated !== (post.occurredAt ?? post.date)}
                <span class="post-updated">↻ {formatDate(post.updated, lang)}</span>
            {/if}
            {#if post.tags?.length}
                <div class="post-tags">
                    {#each post.tags as tag}
                        <a
                            class="tag pill"
                            href={`/${getLink('tags', lang)}/${encodeURIComponent(tag)}`}
                        >{tag}</a>
                    {/each}
                </div>
            {/if}
        </div>
    </header>
    <main class="post-content">
        {@html post.bodyHtml}
    </main>

    {#if related.length > 0}
      <section class="related">
        <h2 class="related-title">{relatedLabel}</h2>
        <ul class="related-list">
          {#each related as r}
            <li>
              <a href={`/${r.url}`} class="related-link">
                <span class="related-date">{formatDate(r.occurredAt ?? r.date, lang)}</span>
                <span class="related-text">{r.title}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if comments && hasFeature('comments')}
      <CommentSection targetType={post.type} targetId={post.id} {lang} />
    {/if}

    <div class="post-end" aria-hidden="true"><Arc size={40} /></div>
  </article>

  {#if headings.length > 0}
    <aside class="toc" aria-label={tocLabel}>
      <nav>
        <p class="toc-title">{tocLabel}</p>
        <ul>
          {#each headings as h}
            <li class:sub={h.level > 2}>
              <a
                href={`#${h.id}`}
                class:active={h.id === activeId}
                onclick={(e) => { e.preventDefault(); scrollToHeading(h.id); }}
              >{h.text}</a>
            </li>
          {/each}
        </ul>
      </nav>
    </aside>
  {/if}
</div>

<style>
    .reading-progress {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: 1001;
        background: var(--color-primary);
        transform-origin: left;
        transform: scaleX(0);
        will-change: transform;
    }

    article {
        max-width: 72ch;
        padding: 96px clamp(16px, 4vw, 24px) clamp(16px, 4vw, 24px);
        line-height: 1.7;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
    }

    .post-layout {
        max-width: 1200px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 240px;
        gap: 48px;
        align-items: start;
    }

    .toc {
        position: sticky;
        top: 96px;
        max-height: calc(100vh - 120px);
        overflow-y: auto;
        padding: 8px 0 8px 16px;
        border-left: 1px solid var(--border-color);
        font-size: 0.875rem;
    }

    .toc-title {
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        margin: 0 0 12px;
    }

    .toc ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .toc li.sub {
        padding-left: 16px;
    }

    .toc a {
        display: block;
        padding: 4px 8px;
        border-radius: 6px;
        color: var(--text-muted);
        border: none;
        line-height: 1.4;
        transition: color 0.15s, background 0.15s;
    }

    .toc a:hover {
        color: var(--primary);
        background: var(--color-surface-container);
    }

    .toc a.active {
        color: var(--color-primary);
        font-weight: 600;
        background: var(--color-primary-container);
    }

    .toc-mobile {
        display: none;
    }

    @media (max-width: 768px) {
        .post-kicker,
        .post-date,
        .post-time,
        .post-updated {
            font-size: 0.75rem;
        }

        .post-layout {
            /* minmax(0, …) keeps long code lines from stretching the grid item */
            grid-template-columns: minmax(0, 1fr);
        }
        .toc {
            display: none;
        }
        .toc-mobile {
            display: block;
            max-width: 72ch;
            margin: 36px auto 0;
            padding: 0 clamp(16px, 4vw, 24px);
            font-size: 0.875rem;
        }
        .toc-mobile summary {
            cursor: pointer;
            font-weight: 600;
            color: var(--color-primary);
            padding: 8px 12px;
            border-radius: 8px;
            background: var(--color-surface-container);
            list-style: none;
        }
        .toc-mobile ul {
            list-style: none;
            margin: 8px 0 0;
            padding: 8px 12px;
            background: var(--color-surface-container-low);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .toc-mobile li.sub {
            padding-left: 14px;
        }
        .toc-mobile a {
            display: block;
            padding: 4px 6px;
            color: var(--text-muted);
            border: none;
        }
        .toc-mobile a:hover {
            color: var(--primary);
        }
        article {
            padding-top: 32px;
        }
    }

    .post-header {
        position: relative;
        overflow: hidden;
        margin-bottom: 2.5rem;
        padding: 40px 0 1.5rem;
        border-bottom: 1px solid var(--border-color);
    }

    .post-watermark {
        position: absolute;
        top: -46px;
        right: -34px;
        width: 320px;
        opacity: 0.09;
        pointer-events: none;
    }

    .post-watermark svg {
        width: 100%;
        height: auto;
    }

    .post-kicker {
        margin: 0 0 14px;
        font-family: var(--font-mono);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--color-bud);
    }

    .post-header h1 {
        font-family: var(--font-serif);
        font-size: clamp(2rem, 5vw, 2.7rem);
        font-weight: 600;
        letter-spacing: -0.015em;
        line-height: 1.2;
        margin: 0 0 1.2rem;
        color: var(--color-ink);
        max-width: 18em;
    }

    .post-meta {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        font-family: var(--font-mono);
        font-size: 0.8rem;
    }

    .post-date {
        color: var(--color-bud);
    }

    .post-time {
        color: var(--text-muted);
    }

    .post-updated {
        color: var(--text-muted);
    }

    .post-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    /* pill shape + colours come from the shared .pill class */
    .tag {
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        font-size: 0.75rem;
        border: 1px solid var(--color-paper-line);
        text-decoration: none;
    }

    /* Anchor offset lives in main.css (html { scroll-padding-top }) so every
       in-page link is covered, not just headings with an id. */
    :global(.post-article > * + *) {
        margin-top: 1.2em;
    }
    /* Scoped to the article body: an unqualified `img` rule also hit the
       comment avatars (40px margin → a 108px-tall comment header). */
    :global(.post-content img) {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 2.5rem auto;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        box-shadow: 0 4px 12px var(--color-shadow);
        object-fit: contain;
    }

    :global(.post-content img + em) {
        display: block;
        text-align: center;
        font-size: 0.9rem;
        color: var(--text-muted);
        margin-top: -1.5rem;
        margin-bottom: 2rem;
    }

    /* Scoped to the article body — these used to be bare `ul, ol, li` rules
       that leaked into the TOC, related list and comment list. */
    :global(.post-content ul, .post-content ol) {
        padding-left: 1.4em;
        margin: 1em 0;
    }

    :global(.post-content li) {
        margin: 0.4em 0;
    }

    :global(.post-content li::marker) {
        color: var(--color-outline);
    }

    .related {
        margin-top: 4rem;
        padding-top: 2rem;
        border-top: 1px solid var(--border-color);
    }

    .related-title {
        font-size: 1.25rem;
        margin: 0 0 1rem;
    }

    .related-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .related-link {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        border: none;
        transition: background 0.15s;
    }

    .related-link:hover {
        background: var(--color-surface-container);
    }

    .related-date {
        flex-shrink: 0;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--text-muted);
    }

    .related-text {
        color: var(--color-on-surface);
        line-height: 1.4;
    }

    .post-end {
        display: flex;
        justify-content: center;
        color: var(--color-bud);
        opacity: 0.7;
        margin: 72px 0 12px;
    }
@media (max-width: 768px) {
  .post-kicker,
  .post-date,
  .post-time,
  .post-updated {
    font-size: 0.75rem;
  }
}
</style>
