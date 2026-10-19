<script>
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { getDictionary, getLink } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  let { lang = 'en' } = $props();

  const t = $derived(getDictionary(lang));
  const homePath = $derived(lang === 'zh' ? '/zh' : '/');

  /** @param {string} text */
  const fill = (text) => text.replace(/\{name\}/g, site.name);
</script>

<svelte:head>
  <title>{pageTitle(t.about.title)}</title>
  <meta name="description" content={fill(t.seo.about.description)} />
  <link rel="canonical" href={`${site.url}/${getLink('about', lang)}`} />
  <link rel="alternate" hreflang="en" href={`${site.url}/about`} />
  <link rel="alternate" hreflang="zh" href={`${site.url}/zh/about`} />
  <link rel="alternate" hreflang="x-default" href={`${site.url}/about`} />
</svelte:head>

<LanguageSwitcher />
<PageLogo href={homePath} />

<main class="about-page">
  <header class="page-head">
    <p class="kicker">{t.about.kicker}</p>
    <h1 class="page-title">{t.about.title}</h1>
    <p class="name-line">
      <span class="name-word">{site.name}</span>
      <span>{t.about.name.pronunciation}</span>
      <span>{t.about.name.meaning}</span>
    </p>
  </header>

  <section class="block">
    <h2>{t.about.who.title}</h2>
    {#each t.about.who.paragraphs as paragraph}
      <p>{paragraph}</p>
    {/each}
    <p class="more"><a href={`/${getLink('projects', lang)}`}>{t.about.who.projectsLink} →</a></p>
  </section>

  <section class="block">
    <h2>{t.about.why.title}</h2>
    {#each t.about.why.paragraphs as paragraph}
      <p>{paragraph}</p>
    {/each}
  </section>

  <section class="block">
    <h2>{t.about.writes.title}</h2>
    {#each t.about.writes.paragraphs as paragraph}
      <p>{paragraph}</p>
    {/each}
  </section>

  <section class="block">
    <h2>{t.about.brands.title}</h2>
    <ol class="names">
      {#each t.about.brands.items as item}
        <li>
          <span class="names-date">{item.date}</span>
          <span class="names-text">
            <strong>{item.name}</strong>
            {#if item.note}<span class="names-note">— {item.note}</span>{/if}
          </span>
        </li>
      {/each}
    </ol>
  </section>

  <section class="block">
    <h2>{t.about.contact.title}</h2>
    <p class="contact-body">{t.about.contact.body}</p>
    <p class="contact-links">
      <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
      <span aria-hidden="true">·</span>
      <a href={site.contact.github} target="_blank" rel="noopener">{t.about.contact.githubLabel}</a>
      <span aria-hidden="true">·</span>
      <a href={lang === 'zh' ? '/zh/feed.xml' : '/feed.xml'}>{t.about.contact.rssLabel}</a>
    </p>
  </section>
</main>

<style>
  .about-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

  /* .kicker / .page-title live in main.css */
  .page-head {
    margin-bottom: 48px;
  }

  .name-line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin: 18px 0 0;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0.02em;
    color: var(--color-ink-soft);
  }

  .name-word {
    color: var(--color-bud-deep);
  }

  .block {
    padding: 28px 0;
    border-top: 1px solid var(--color-paper-line);
  }

  .block h2 {
    margin: 0 0 14px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--color-ink-faint);
  }

  .block p {
    margin: 0 0 0.9em;
    font-size: 1.02rem;
    line-height: 1.8;
    color: var(--color-ink);
  }

  .block p:last-child {
    margin-bottom: 0;
  }

  .block .more {
    margin: 16px 0 0;
  }

  .more a {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  .more a:hover {
    color: var(--color-bud);
    border-bottom-color: var(--color-bud);
  }

  .names {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .names li {
    display: grid;
    grid-template-columns: 76px 1fr;
    gap: 16px;
    align-items: baseline;
    font-size: 0.97rem;
    line-height: 1.7;
    color: var(--color-ink);
  }

  .names-date {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.04em;
    color: var(--color-bud-deep);
  }

  .names-text strong {
    font-weight: 500;
  }

  .names-note {
    color: var(--color-ink-soft);
  }

  .block .contact-body {
    margin-bottom: 12px;
  }

  .block .contact-links {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .contact-links a {
    color: var(--color-bud-deep);
    border-bottom: 1px solid var(--color-bud-soft);
  }

  .contact-links a:hover {
    color: var(--color-bud);
    border-bottom-color: var(--color-bud);
  }

  @media (max-width: 640px) {
    .about-page {
      padding-top: 96px;
    }

    .names li {
      grid-template-columns: 62px 1fr;
      gap: 12px;
    }
  }
</style>
