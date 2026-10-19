<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import ProjectsList from '$lib/components/projects/Projects.svelte';
  import { getDictionary, getLink } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { lang = 'en', projects = [] } = $props();

  let t = $derived(getDictionary(lang));
  const homePath = $derived(lang === 'zh' ? '/zh' : '/');
</script>

<svelte:head>
  <title>{pageTitle(t.seo.projects.label)}</title>
  <meta name="description" content={t.seo.projects.description} />
  <link rel="canonical" href={`${site.url}/${getLink('projects', lang)}`} />
  <link rel="alternate" hreflang="en" href={`${site.url}/projects`} />
  <link rel="alternate" hreflang="zh" href={`${site.url}/zh/projects`} />
  <link rel="alternate" hreflang="x-default" href={`${site.url}/projects`} />
</svelte:head>

<LanguageSwitcher />
<PageLogo href={homePath} />

<main class="projects-page">
  <header class="page-head">
    <p class="kicker">{t.nav.projects}</p>
    <h1 class="page-title">{t.projects.title}</h1>
    <p class="page-sub">{t.projects.subtitle}</p>
  </header>

  <div class="section-head">
    <span class="section-label">{t.nav.projects}</span>
    <span class="section-count">{String(projects.length).padStart(2, '0')} PCS</span>
  </div>

  <ProjectsList {projects} {lang} />
</main>

<style>
  .projects-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  /* .kicker / .page-title / .page-sub live in main.css */
  .page-head {
    margin-bottom: 56px;
  }

  .page-title {
    margin-bottom: 12px;
  }

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin: 0 0 24px;
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
  }

  .section-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-bud);
    letter-spacing: 0.1em;
  }

  @media (max-width: 768px) {
    .projects-page {
      padding-top: 96px;
    }
  }
</style>
