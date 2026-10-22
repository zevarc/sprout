<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  let { project, bodyHtml = '', lang = site.defaultLocale, translations = [] } = $props();

  const t = $derived(getDictionary(lang));
  const defaultAlt = $derived(translations.find((a) => a.lang === site.defaultLocale));
  const switcherLinks = $derived(
    Object.fromEntries(translations.map((a) => [a.lang, `/${a.url}`]))
  );
  const home = $derived(homePath(lang));
  const projectsPath = $derived(getLink('projects', lang));
  const statusLabels = $derived(/** @type {Record<string, string>} */ (t.projects.stage ?? {}));
  const statusLabel = $derived(
    project.stage ? (statusLabels[project.stage] ?? project.stage) : ''
  );
  const ogImage = $derived(`${site.url}/${getLink(`og/${project.slug}.svg`, lang)}`);
  const jsonLd = $derived(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: project.title,
      description: project.description,
      url: `${site.url}/${project.url}`,
      author: { '@type': 'Person', name: site.author },
      dateCreated: project.year || undefined,
      keywords: project.tags.length ? project.tags.join(', ') : undefined
    }).replace(/</g, '\\u003c')
  );
</script>

<svelte:head>
  <title>{pageTitle(project.title)}</title>
  <meta name="description" content={project.description} />
  <link rel="canonical" href={`${site.url}/${project.url}`} />
  {#if translations.length > 1}
    {#each translations as alt}
      <link rel="alternate" hreflang={alt.lang} href={`${site.url}/${alt.url}`} />
    {/each}
    {#if defaultAlt}
      <link rel="alternate" hreflang="x-default" href={`${site.url}/${defaultAlt.url}`} />
    {/if}
  {/if}
  <meta property="og:type" content="article" />
  <meta property="og:image" content={ogImage} />
  <meta name="twitter:image" content={ogImage} />
  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<LanguageSwitcher links={switcherLinks} />
<PageLogo href={home} />

<main class="project-page">
  <a class="back" href={`/${projectsPath}`}>← {t.nav.projects}</a>

  <header class="project-head">
    <div class="meta">
      <span class="year">{project.year}</span>
      {#if project.stage}
        <span class="status pill" data-stage={project.stage}>{statusLabel}</span>
      {/if}
    </div>
    <div class="title-row">
      {#if project.image}
        <img class="icon" src={project.image} alt="" width="48" height="48" />
      {/if}
      <h1>{project.title}</h1>
    </div>
    {#if project.description}
      <p class="summary">{project.description}</p>
    {/if}
    <div class="links">
      {#if project.website}
        <a href={project.website} target="_blank" rel="noopener">↗ {project.website.replace(/^https?:\/\//, '')}</a>
      {/if}
      {#if project.repoUrl}
        <a href={project.repoUrl} target="_blank" rel="noopener">github</a>
      {/if}
    </div>
  </header>

  {#if bodyHtml}
    <div class="body">{@html bodyHtml}</div>
  {/if}

  {#if project.tags.length > 0}
    <div class="tags">
      {#each project.tags as tag}
        <span class="tag pill">{tag}</span>
      {/each}
    </div>
  {/if}
</main>

<style>
  .project-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  .back {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    color: var(--color-ink-faint);
    border: none;
    margin-bottom: 28px;
  }

  .back:hover {
    color: var(--color-bud);
  }

  .project-head {
    padding-bottom: 28px;
    border-bottom: 1px solid var(--color-paper-line);
    margin-bottom: 32px;
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-bud);
  }

  .status {
    padding: 2px 9px;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .status[data-stage='archived'] {
    background: var(--color-surface-container-high);
    color: var(--color-ink-faint);
  }

  h1 {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: clamp(2rem, 5vw, 2.8rem);
    letter-spacing: -0.015em;
    line-height: 1.2;
    margin: 0 0 14px;
    color: var(--color-ink);
  }

  .summary {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.75;
    color: var(--color-ink-soft);
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-top: 18px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }

  .links a {
    color: var(--color-bud-deep);
    border: none;
  }

  .links a:hover {
    color: var(--color-bud);
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
  }

  .title-row h1 {
    margin: 0;
  }

  .icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    object-fit: contain;
    padding: 5px;
    border-radius: 10px;
    background: var(--color-surface-container-low);
    border: 1px solid var(--color-paper-line);
  }

  .body {
    font-size: 1.02rem;
    line-height: 1.8;
    color: var(--color-ink);
  }

  .body :global(h2) {
    margin: 2.2em 0 0.7em;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--color-ink-faint);
  }

  .body :global(h2:first-child) {
    margin-top: 0;
  }

  .body :global(p) {
    margin: 0 0 1em;
  }

  .body :global(ul) {
    margin: 0 0 1em;
    padding-left: 1.2em;
  }

  .body :global(li) {
    margin: 0.35em 0;
  }

  .body :global(li::marker) {
    color: var(--color-bud);
  }

  .body :global(strong) {
    font-weight: 600;
  }

  .body :global(a) {
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  .body :global(code) {
    font-family: var(--font-mono);
    font-size: 0.9em;
    padding: 0.15em 0.35em;
    border-radius: 4px;
    background: var(--color-surface-container);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 44px;
    padding-top: 24px;
    border-top: 1px solid var(--color-paper-line);
  }

  .tag {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 3px 10px;
  }

  @media (max-width: 640px) {
    .project-page {
      padding-top: 96px;
    }
  }
</style>
