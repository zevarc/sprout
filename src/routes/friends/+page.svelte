<script>
  import FriendApplyForm from '$lib/components/friends/FriendApplyForm.svelte';
  import FriendGrid from '$lib/components/friends/FriendGrid.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import PageLogo from '$lib/components/PageLogo.svelte';
  import { getDictionary, getLink, homePath } from '$lib/i18n/index.js';
  import { site } from '$lib/site';
  import { pageTitle } from '$lib/seo';

  const { data } = $props();
  const { friends = [], canApply = false, lang = site.defaultLocale } = $derived(data);

  const t = $derived(getDictionary(lang));
  const home = $derived(homePath(lang));
  const basePath = $derived(`/${getLink('friends', lang)}`);
</script>

<svelte:head>
  <title>{pageTitle(t.friends.title)}</title>
  <meta name="description" content={t.friends.subtitle} />
  <link rel="canonical" href={`${site.url}${basePath}`} />
  {#each site.locales as loc}
    <link rel="alternate" hreflang={loc.code} href={`${site.url}/${getLink('friends', loc.code)}`} />
  {/each}
  {#if site.locales.length > 1}
    <link
      rel="alternate"
      hreflang="x-default"
      href={`${site.url}/${getLink('friends', site.defaultLocale)}`}
    />
  {/if}
</svelte:head>

<LanguageSwitcher />
<PageLogo href={home} />

<main class="friends-page">
  <header class="page-head">
    <p class="kicker">{t.nav.friends}</p>
    <h1 class="page-title">{t.friends.title}</h1>
    <p class="page-sub">{t.friends.subtitle}</p>
  </header>

  <div class="section-head">
    <span class="section-label">{t.nav.friends}</span>
    <span class="section-count">{String(friends.length).padStart(2, '0')}</span>
  </div>

  <FriendGrid {friends} {lang} />

  {#if canApply}
    <FriendApplyForm {lang} />
  {/if}
</main>

<style>
  .friends-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 120px clamp(20px, 5vw, 48px) 140px;
  }

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
    .friends-page {
      padding-top: 96px;
    }
  }
</style>
