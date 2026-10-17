<script>
  import { onMount } from 'svelte';

  let visible = $state(false);
  /** @type {HTMLDivElement | null} */
  let sectionEl = null;

  let { projects } = $props();

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
      <article class="project-card" style="animation-delay: {i * 120}ms">
        <div class="project-header">
          <div class="project-meta">
            <span class="project-year">{project.year}</span>
            <h3 class="project-title">{project.title}</h3>
          </div>
          <div class="project-links">
            {#if project.website}
              <a class="project-link" href={project.website} target="_blank" rel="noopener">↗</a>
            {/if}
            {#if project.github}
              <a class="project-link" href={project.github} target="_blank" rel="noopener">github</a>
            {/if}
          </div>
        </div>

        <div class="project-body">
          <p>{project.description}</p>
        </div>

        <div class="project-footer">
          <div class="tech-stack">
            {#each project.tags as tech}
              <span class="tech-tag">{tech}</span>
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

  .project-card {
    display: flex;
    flex-direction: column;
    background: var(--color-surface-container-low);
    border: 1px solid var(--color-paper-line);
    border-radius: 14px;
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
    box-shadow: 0 8px 26px rgba(94, 139, 116, 0.14);
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

  .project-links {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .project-link {
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
    border-radius: 999px;
    background: var(--color-bud-pale);
    color: var(--color-bud-deep);
  }

  @media (max-width: 767px) {
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
