<script>
  import { onMount } from 'svelte';
  import ProjectsList from '$lib/components/projects/Projects.svelte';
  import { getDictionary, getLink } from '$lib/i18n/index.js';
  import { site } from '$lib/site';

  const { lang = 'en', posts = [], projects = [] } = $props();

  let t = $derived(getDictionary(lang));
  const brand = $derived(site.brand[lang] ?? site.brand[site.defaultLocale]);
  const postsPath = $derived(getLink('posts', lang));
  const searchPath = $derived(getLink('search', lang));
  const switchPath = $derived(lang === 'zh' ? '/' : '/zh');

  /* ---------- 区块 reveal ---------- */
  /** @type {HTMLElement | null} */
  let postsEl = $state(null);
  /** @type {HTMLElement | null} */
  let projectsEl = $state(null);
  let postsVisible = $state(false);
  let projectsVisible = $state(false);

  /* ---------- 滚动方向感知浮动按钮 ---------- */
  let showFloat = $state(false);
  let lastY = 0;

  function handleScroll() {
    const y = window.scrollY;
    showFloat = y < lastY && y > 320;
    lastY = y;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          if (e.target === postsEl) postsVisible = true;
          if (e.target === projectsEl) projectsVisible = true;
        });
      },
      { threshold: 0.06 }
    );
    if (postsEl) observer.observe(postsEl);
    if (projectsEl) observer.observe(projectsEl);
    return () => observer.disconnect();
  });

  /**
   * @param {string} dateStr
   */
  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }
</script>

<svelte:head>
  <title>{brand.seoTitle}</title>
  <meta name="description" content={brand.seoDescription} />
  <meta property="og:title" content={brand.seoTitle} />
  <meta property="og:description" content={brand.seoDescription} />
  <meta property="og:type" content="website" />
  <link rel="canonical" href={lang === 'zh' ? `${site.url}/zh` : `${site.url}/`} />
  <link rel="alternate" hreflang="en" href={`${site.url}/`} />
  <link rel="alternate" hreflang="zh" href={`${site.url}/zh`} />
  <link rel="alternate" hreflang="x-default" href={`${site.url}/`} />
</svelte:head>

<svelte:window onscroll={handleScroll} />

<div class="home">
  <header class="hero">
    <div class="hero-bg" aria-hidden="true">
      <svg class="hero-bg-logo" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="bg-grad" x1="0" y1="1" x2="0.45" y2="0">
            <stop offset="0%" stop-color="var(--grad-bud-a)" />
            <stop offset="55%" stop-color="var(--grad-bud-b)" />
            <stop offset="100%" stop-color="var(--grad-bud-c)" />
          </linearGradient>
        </defs>
        <path
          d="m 7.7915687,21.187121 c -2.165092,-0.244068 -3.830287,-1.277655 -4.939085,-3.065689 -0.754217,-1.21624 -1.039193,-2.943583 -0.728762,-4.417303 0.458748,-2.177836 1.90419,-3.7857163 4.110442,-4.5723732 0.646862,-0.230644 0.736367,-0.235037 5.3888013,-0.264503 3.226852,-0.02044 4.731014,0.0035 4.731014,0.07527 0,0.05788 -1.434594,1.2529962 -3.187987,2.6558112 -1.983739,1.587105 -3.152147,2.586411 -3.093109,2.645449 0.155939,0.15594 5.790281,0.0058 6.676721,-0.177886 0.872069,-0.180734 1.860728,-0.618482 2.429913,-1.075892 0.528547,-0.424751 1.17931,-1.36539 1.446824,-2.091296 0.316697,-0.859367 0.314615,-2.4579732 -0.0044,-3.3869452 -0.605911,-1.764353 -1.801259,-2.831745 -3.721076,-3.322751 -1.062792,-0.271817 -3.221534,-0.277609 -4.240607,-0.01138 -1.38588,0.362059 -2.9743383,1.144851 -4.1469833,2.043634 -0.358925,0.275101 -0.677011,0.500183 -0.706859,0.500183 -0.318269,0 0.795456,-1.287967 1.801882,-2.083786 0.9801933,-0.775076 2.1435003,-1.372752 3.2543573,-1.672003 0.634,-0.170792 1.09491,-0.217999 2.125161,-0.217659 3.027867,10e-4 4.875739,0.959253 6.26313,3.247886 0.655203,1.08082 0.923312,2.883432 0.632136,4.2501172 -0.4103,1.925804 -1.44525,3.284562 -3.157621,4.145559 -1.116912,0.561594 -1.79428,0.638027 -6.221139,0.701985 -3.8294183,0.05533 -4.7521743,0.02226 -4.7521743,-0.170296 0,-0.048 1.412001,-1.216008 3.1377803,-2.59557 1.961688,-1.568144 3.102072,-2.5440033 3.04251,-2.6035643 -0.15632,-0.156321 -5.7888573,-0.0066 -6.6771133,0.177494 -1.453996,0.3013363 -2.519285,0.9544773 -3.245608,1.9899223 -1.699621,2.422976 -0.849827,6.082015 1.712973,7.375713 1.043991,0.527004 1.963863,0.711161 3.552297,0.711161 1.6602403,0 2.5807283,-0.22106 4.1948573,-1.007416 0.864942,-0.421374 1.351776,-0.730681 2.711048,-1.72245 0.196699,-0.143518 0.199566,-0.139591 0.07389,0.101198 -0.465987,0.892799 -2.183318,2.384664 -3.489366,3.031252 -1.47248,0.728984 -3.1895093,1.007268 -4.9738343,0.806122 z"
          fill="url(#bg-grad)"
        />
      </svg>
    </div>

    <div class="hero-copy">
      <p class="phonetic">{brand.phonetic}</p>
      <h1 class="name">{site.name}</h1>
      <p class="etymology">
        <span>{brand.etymology.zero}</span><em>→</em>
        <span>{brand.etymology.evolution}</span><em>→</em>
        <span>{brand.etymology.arc}</span>
      </p>
      <p class="slogan">{brand.slogan}</p>
      <p class="desc">{brand.description}</p>
    </div>

    <div class="hero-scroll" aria-hidden="true">
      <span class="scroll-label">scroll</span>
      <span class="scroll-line"></span>
    </div>
  </header>

  {#if posts.length > 0}
    <section class="posts-section" bind:this={postsEl} class:visible={postsVisible}>
      <div class="section-head">
        <h2 class="section-label">{t.nav.posts}</h2>
        <span class="section-count">{String(posts.length).padStart(2, '0')} REC</span>
      </div>
      <ul class="post-list">
        {#each posts as p, i}
          <li class="post-item">
            <a class="post-row" href={`/${p.url}`}>
              <span class="post-index">{String(i + 1).padStart(2, '0')}</span>
              <span class="post-date">{formatDate(p.date)}</span>
              <span class="post-title">{p.title}</span>
              <span class="post-time">{p.readTime} {t.posts.readTime}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if site.features.projects && projects.length > 0}
    <section class="projects-section" bind:this={projectsEl} class:visible={projectsVisible}>
      <div class="section-head">
        <h2 class="section-label">{t.nav.projects}</h2>
        <span class="section-count">{String(projects.length).padStart(2, '0')} PCS</span>
      </div>
      <ProjectsList {projects} />
    </section>
  {/if}

  <div class="float-actions" class:show={showFloat}>
    {#if site.features.moments}
      <a class="float-btn" href="/moments" title={t.moments.title} aria-label={t.moments.title}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 2" />
        </svg>
      </a>
    {/if}
    <a class="float-btn" href={searchPath} title={t.search.title} aria-label={t.search.title}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    </a>
    <a class="float-btn lang" href={switchPath} title={lang === 'zh' ? 'English' : '中文'}>
      {lang === 'zh' ? 'EN' : '中'}
    </a>
    <button class="float-btn" onclick={scrollToTop} aria-label="top">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </div>
</div>

<style>
  .home {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-paper);
    background-image:
      linear-gradient(var(--grid-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
    background-size: 36px 36px;
    color: var(--color-ink);
    -webkit-font-smoothing: antialiased;
  }

  /* ---------- Hero (favicon 水印背景 + 文字叠加, 独占一屏) ---------- */
  .hero {
    position: relative;
    height: 100vh;
    min-height: 640px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 24px;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .hero-bg-logo {
    width: min(92vw, 760px);
    height: auto;
    opacity: 0.12;
    animation: bg-float 9s ease-in-out infinite;
  }

  @media (prefers-color-scheme: dark) {
    .hero-bg-logo {
      opacity: 0.16;
    }
  }

  @keyframes bg-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-12px);
    }
  }

  .hero-copy {
    position: relative;
    z-index: 2;
    max-width: 720px;
  }

  .phonetic {
    margin: 0 0 12px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    letter-spacing: 0.1em;
    color: var(--color-ink-faint);
  }

  .name {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(3.4rem, 11vw, 6rem);
    line-height: 1;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--color-ink);
  }

  .etymology {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin: 24px 0 0;
    font-family: var(--font-mono);
    font-size: clamp(0.8rem, 2vw, 0.95rem);
    color: var(--color-ink-soft);
  }

  .etymology em {
    color: var(--color-bud);
    font-style: normal;
  }

  .slogan {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 400;
    font-size: clamp(1.2rem, 3.2vw, 1.6rem);
    margin: 30px 0 0;
    color: var(--color-ink);
  }

  .desc {
    max-width: 560px;
    margin: 20px auto 0;
    font-size: 1.02rem;
    line-height: 1.75;
    color: var(--color-ink-soft);
  }

  .hero-scroll {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 2;
  }

  .scroll-label {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-ink-faint);
  }

  .scroll-line {
    width: 1px;
    height: 40px;
    background: linear-gradient(to bottom, var(--color-bud), transparent);
    animation: scroll-pulse 2s ease-in-out infinite;
  }

  @keyframes scroll-pulse {
    0% {
      opacity: 0.2;
      transform: scaleY(0.4);
      transform-origin: top;
    }
    50% {
      opacity: 1;
      transform: scaleY(1);
      transform-origin: top;
    }
    100% {
      opacity: 0.2;
      transform: scaleY(0.4);
      transform-origin: top;
    }
  }

  /* ---------- 内容区块 (reveal + 大留白) ---------- */
  .posts-section,
  .projects-section {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 110px clamp(20px, 5vw, 48px) 40px;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  .posts-section.visible,
  .projects-section.visible {
    opacity: 1;
    transform: none;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0 0 20px;
    border-bottom: 1px solid var(--color-paper-line);
    padding-bottom: 12px;
  }

  .section-label {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--color-ink-faint);
    margin: 0;
  }

  .section-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-bud);
    letter-spacing: 0.1em;
  }

  /* ---------- 文章列表 (生长记录) ---------- */
  .post-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .post-item {
    position: relative;
  }

  .post-row {
    display: grid;
    grid-template-columns: 40px 92px 1fr auto;
    align-items: baseline;
    gap: 16px;
    padding: 15px 4px;
    border: none;
    color: var(--color-ink);
    border-bottom: 1px solid var(--color-paper-line);
    transition: color 0.2s;
  }

  /* 生长线：hover 时从左侧伸出 */
  .post-row::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 50%;
    width: 10px;
    height: 2px;
    border-radius: 2px;
    background: var(--color-bud);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.28s ease;
  }

  .post-row:hover::before {
    transform: scaleX(1);
  }

  .post-row:hover {
    color: var(--color-bud-deep);
  }

  .post-index {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-bud);
    opacity: 0.85;
  }

  .post-date {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-ink-faint);
  }

  .post-title {
    font-family: var(--font-serif);
    font-size: 1.12rem;
    font-weight: 500;
    line-height: 1.35;
  }

  .post-time {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-faint);
    white-space: nowrap;
  }

  .projects-section {
    padding-top: 120px;
    padding-bottom: 140px;
  }

  /* ---------- 浮动按钮 ---------- */
  .float-actions {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 900;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(14px);
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
  }

  .float-actions.show {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .float-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: var(--color-surface);
    border: 1px solid var(--color-paper-line);
    color: var(--color-ink-soft);
    box-shadow: 0 4px 16px rgba(41, 55, 47, 0.12);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, box-shadow 0.2s;
  }

  .float-btn:hover {
    color: var(--color-bud);
    border-color: var(--color-bud-soft);
    box-shadow: 0 6px 20px rgba(94, 139, 116, 0.22);
  }

  .float-btn.lang {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  /* ---------- Responsive ---------- */
  @media (max-width: 820px) {
    .hero {
      min-height: 560px;
      padding: 0 20px;
    }

    .hero-bg-logo {
      width: 96vw;
    }

    .post-row {
      grid-template-columns: 32px 1fr;
      gap: 12px;
    }

    .post-date {
      grid-column: 2;
      grid-row: 1;
      margin-top: -10px;
    }

    .post-time {
      display: none;
    }

    .posts-section,
    .projects-section {
      padding-top: 80px;
    }

    .float-actions {
      right: 16px;
      bottom: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-bg-logo {
      animation: none;
    }

    .scroll-line {
      animation: none;
    }
  }
</style>
