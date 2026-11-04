<script>
    import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
    import PageLogo from '$lib/components/PageLogo.svelte';
    import Arc from '$lib/components/visuals/Arc.svelte';
    import CommentSection from '$lib/components/comments/CommentSection.svelte';
    import PostToc from '$lib/components/posts/PostToc.svelte';
    import BackToTop from '$lib/components/posts/BackToTop.svelte';
    import { onMount } from 'svelte';
    import { formatDate, getDictionary, getLink, homePath as localeHome } from '$lib/i18n/index.js';
    import { site } from '$lib/site';
    import { hasFeature } from '$lib/engine/features';
    import { getContentType } from '$lib/content/registry';
    import { breadcrumbJsonLd, pageTitle, shareImage } from '$lib/seo';

    const { post, related = [], comments = true, translations = [] } = $props();

    let progress = $state(0);
    let progressFrame = 0;

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
      progressFrame = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      progress = scrollable > 0 ? Math.min(1, doc.scrollTop / scrollable) : 0;
    }

    /** One rAF per frame, however many scroll events arrive. */
    function handleScroll() {
      if (progressFrame) return;
      progressFrame = requestAnimationFrame(updateProgress);
    }

    onMount(updateProgress);

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

{#if headings.length > 1}
  <details class="toc-mobile">
    <summary>{tocLabel}</summary>
    <PostToc
      {headings}
      label={tocLabel}
      expandLabel={t.posts.tocExpand}
      collapseLabel={t.posts.tocCollapse}
      compact
    />
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
    <main class="prose post-content">
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

  {#if headings.length > 1}
    <aside class="toc-desktop">
      <PostToc
        {headings}
        label={tocLabel}
        expandLabel={t.posts.tocExpand}
        collapseLabel={t.posts.tocCollapse}
      />
    </aside>
  {/if}
</div>

<BackToTop label={t.posts.backToTop} />

<style>
    .reading-progress {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: 1001;
        background: var(--color-bud);
        transform-origin: left;
        transform: scaleX(0);
        will-change: transform;
    }

    article {
        max-width: var(--prose-measure);
        padding: 40px 0 clamp(16px, 3vw, 32px);
        line-height: 1.7;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
    }

    /* Body typography lives in `src/styles/prose.css` — one source for every
       markdown renderer. Only layout belongs here. */

    /* One reading sheet: title, body, related posts, comments and the TOC share
       a single surface, so the blueprint grid frames a document instead of
       showing through the text column. */
    .post-layout {
        max-width: 1024px;
        margin: 88px auto 120px;
        padding: 0 clamp(20px, 3vw, 48px);
        background: var(--color-surface-raised);
        border: 1px solid var(--color-panel-line);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-soft);
        display: grid;
        grid-template-columns: minmax(0, var(--prose-measure)) 232px;
        justify-content: center;
        gap: clamp(28px, 4vw, 56px);
        align-items: start;
    }

    .toc-desktop {
        position: sticky;
        top: 96px;
        /* Optically aligns the "contents" label with the article's kicker. */
        padding: 76px 0 8px;
    }

    .toc-mobile {
        display: none;
    }

    /* The sheet needs ~928px of columns; under ~1100px it would sit almost edge
       to edge, so the layout becomes the full-bleed page and the TOC moves above
       the article as a <details> panel. */
    @media (max-width: 1099px) {
        /* Phones get a full-bleed page instead of a giant card: same surface,
           no radius/shadow, hairlines top and bottom. */
        .post-layout {
            /* minmax(0, …) keeps long code lines from stretching the grid item */
            grid-template-columns: minmax(0, 1fr);
            margin: 0 auto;
            padding: 0 clamp(16px, 4vw, 24px);
            border: 0;
            border-block: 1px solid var(--color-panel-line);
            border-radius: 0;
            box-shadow: none;
        }
        article {
            padding-top: 24px;
        }
        .toc-desktop {
            display: none;
        }
        .toc-mobile {
            display: block;
            max-width: var(--prose-measure);
            /* Clears the fixed logo + language switcher. */
            margin: 76px auto 0;
            padding: 0 clamp(16px, 4vw, 24px);
        }
        .toc-mobile summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            padding: 10px 14px;
            border: 1px solid var(--color-outline);
            border-radius: var(--radius-md);
            background: var(--color-surface-container-low);
            color: var(--color-bud-deep);
            font-family: var(--font-mono);
            font-size: 0.72rem;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            list-style: none;
        }
        .toc-mobile summary::-webkit-details-marker {
            display: none;
        }
        .toc-mobile summary::after {
            content: '▾';
            transition: transform var(--dur-fast) var(--ease-out);
        }
        .toc-mobile[open] summary::after {
            transform: rotate(180deg);
        }
        /* The <summary> already carries the label. */
        .toc-mobile :global(.toc-title) {
            display: none;
        }
        .toc-mobile :global(.toc) {
            margin-top: 10px;
            padding: 12px 12px 14px;
            border: 1px solid var(--color-outline);
            border-radius: var(--radius-md);
            background: var(--color-surface-container-low);
        }
    }

    /* Print: the reading sheet becomes plain paper (component-owned rules, so no
       !important war with the global print block). */
    @media print {
        .post-layout {
            display: block;
            max-width: none;
            margin: 0;
            padding: 0;
            background: none;
            border: 0;
            border-radius: 0;
            box-shadow: none;
        }
        article {
            max-width: none;
            padding: 0;
        }
        .toc-desktop,
        .toc-mobile,
        .related,
        .post-end {
            display: none;
        }
    }

    @media (max-width: 768px) {
        .post-kicker,
        .post-date,
        .post-time,
        .post-updated {
            font-size: 0.75rem;
        }
    }

    .post-header {
        position: relative;
        overflow: hidden;
        margin-bottom: 2.5rem;
        padding: 40px 0 1.5rem;
        border-bottom: 1px solid var(--color-outline);
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
        color: var(--color-bud-deep);
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
        color: var(--color-bud-deep);
    }

    .post-time {
        color: var(--color-text-meta);
    }

    .post-updated {
        color: var(--color-text-meta);
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
        border: 1px solid var(--color-outline);
        text-decoration: none;
        transition: background var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out);
    }

    .tag:hover {
        background: var(--color-press-tint);
        border-color: var(--color-bud-soft);
    }

    .tag:active {
        background: color-mix(in srgb, var(--color-bud) 26%, var(--color-paper));
    }

    .related {
        margin-top: 4rem;
        padding-top: 2rem;
        border-top: 1px solid var(--color-divider);
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

    .related-link:active {
        background: var(--color-press-tint);
    }

    .related-link:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: -2px;
        background: var(--color-surface-container);
    }

    .related-date {
        flex-shrink: 0;
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--color-text-meta);
    }

    .related-text {
        color: var(--color-on-surface);
        line-height: 1.4;
    }

    .post-end {
        display: flex;
        justify-content: center;
        color: var(--color-bud-deep);
        opacity: 0.7;
        margin: 72px 0 12px;
    }
</style>
