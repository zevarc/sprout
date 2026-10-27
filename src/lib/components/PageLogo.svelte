<script>
  import BrandMark from './visuals/BrandMark.svelte';
  import { site } from '$lib/site';

  /**
   * PageLogo — 页面左上角固定品牌标识（点击回首页）。
   * @prop {string} href - 点击目标（默认首页）
   */
  let { href = '/' } = $props();
</script>

<a class="page-logo" href={href} aria-label={site.name}>
  <span class="page-logo-icon"><BrandMark size={22} /></span>
  <span>{site.name}</span>
</a>

<style>
  .page-logo {
    position: fixed;
    top: 20px;
    left: 24px;
    z-index: 900;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-serif);
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--color-ink);
    border: none;
    opacity: 0.85;
    transition: opacity 0.2s, color 0.2s;
  }

  .page-logo:hover {
    opacity: 1;
    color: var(--color-bud);
  }

  .page-logo-icon {
    display: flex;
    color: var(--color-bud);
  }

  @media (max-width: 768px) {
    .page-logo {
      top: 16px;
      left: 16px;
    }
  }
@media (max-width: 768px) {
  .page-logo {
    min-height: 24px;
  }
}
</style>
