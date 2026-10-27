<script>
  import { onMount } from 'svelte';
  import { getDictionary } from '$lib/i18n/index.js';
  import { site } from '$lib/site';

  let visible = $state(false);
  /** @type {HTMLDivElement | null} */
  let sectionEl = null;

  let { projects, lang = site.defaultLocale } = $props();

  const t = $derived(getDictionary(lang));

  onMount(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible = true;
        });
      },
      { threshold: 0.1 }
    );

    if (sectionEl) observer.observe(sectionEl);

    return () => observer.disconnect();
  });
</script>

<div class="projects-container" bind:this={sectionEl} class:visible>
  <div class="projects-list">
    {#each projects as project, i}
      <article class="project-card card" style="animation-delay: {i * 120}ms">
        <div class="project-header">
          <div class="project-meta">
            <span class="project-year">{project.year}</span>
            <h2 class="project-title"><a href={`/${project.url}`}>{project.title}</a></h2>
          </div>
          <div class="project-links">
            {#if project.stage}
              <span class="project-status pill">{project.stage}</span>
            {/if}
            {#if project.website}
              <a
                class="project-link"
                href={project.website}
                target="_blank"
                rel="noopener"
                aria-label={`${project.title} — ${t.projects.websiteLabel}`}
              ><span aria-hidden="true">↗</span></a>
            {/if}
            {#if project.repoUrl}
              <a
                class="project-link"
                href={project.repoUrl}
                target="_blank"
                rel="noopener"
                aria-label={`${project.title} — ${t.projects.githubLabel}`}
              >github</a>
            {/if}
          </div>
        </div>

        <div class="project-body">
          <p>{project.description}</p>
        </div>

        <div class="project-footer">
          <div class="tech-stack">
            {#each project.tags as tech}
              <span class="tech-tag pill">{tech}</span>
            {/each}
          </div>
        </div>
      </article>
    {/each}
  </div>
</div>

<style>
  .projects-container {
    max-width: 900px;
    margin: 0 auto;
    opacity: 0;
    transform: translateY(24px);
    transition: all 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .projects-container.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .projects-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }

  /* surface + border + radius come from the shared .card class */
  .project-card {
    display: flex;
    flex-direction: column;
    padding: 22px 24px;
    opacity: 0;
    transform: translateY(16px);
    animation: cardAppear 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: inherit;
    transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
  }

  @keyframes cardAppear {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .project-card:hover {
    border-color: var(--color-bud-soft);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .project-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .project-year {
    font-size: 0.75rem;
    color: var(--color-bud);
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
  }

  .project-title {
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--color-ink);
    margin: 0;
  }

  .project-title a {
    display: inline-block;
    min-height: 24px;
    line-height: 1.4;
    color: inherit;
    border: none;
  }

  .project-title a:hover {
    color: var(--color-bud);
  }

  /* pill shape + colours come from the shared .pill class */
  .project-status {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
  }

  .project-links {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .project-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* WCAG 2.2 target size: the ↗ link used to be 8×20px */
    min-width: 24px;
    min-height: 24px;
    font-size: 0.8rem;
    font-family: var(--font-mono);
    color: var(--color-ink-soft);
    border: none;
    text-decoration: none;
    transition: color 0.2s;
  }

  .project-link:hover {
    color: var(--color-bud);
  }

  .project-body {
    flex: 1;
    margin-bottom: 14px;
  }

  .project-body p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.65;
    color: var(--color-ink-soft);
  }

  .project-footer {
    padding-top: 14px;
    border-top: 1px solid var(--color-paper-line);
  }

  .tech-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tech-tag {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    padding: 4px 10px;
  }

  @media (max-width: 767px) {
    .project-status,
    .tech-tag {
      font-size: 0.75rem;
    }

    .projects-list {
      grid-template-columns: 1fr;
    }

    .project-card {
      padding: 18px 20px;
    }

    .project-title {
      font-size: 1.15rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .project-card {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
