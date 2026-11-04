<script>
  import { onMount } from 'svelte';

  /**
   * Floating "back to top" control for long pages.
   *
   * Appears once the reader is well past the fold, updates on an rAF tick (not
   * per scroll event) and respects `prefers-reduced-motion`.
   *
   * @type {{ label?: string, threshold?: number }}
   */
  let { label = 'Back to top', threshold = 640 } = $props();

  let visible = $state(false);
  let frame = 0;

  function update() {
    frame = 0;
    visible = window.scrollY > threshold;
  }

  function handleScroll() {
    if (frame) return;
    frame = requestAnimationFrame(update);
  }

  function toTop() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  onMount(() => {
    update();
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
  });
</script>

<svelte:window onscroll={handleScroll} />

<button
  type="button"
  class="back-to-top"
  class:visible
  aria-label={label}
  title={label}
  tabindex={visible ? 0 : -1}
  onclick={toTop}
>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 19V5M5 12l7-7 7 7"
    />
  </svg>
</button>

<style>
  .back-to-top {
    position: fixed;
    right: clamp(16px, 3vw, 28px);
    bottom: calc(clamp(16px, 3vw, 28px) + env(safe-area-inset-bottom));
    z-index: 900;
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-outline);
    background: var(--color-surface-container-low);
    color: var(--color-bud-deep);
    box-shadow: var(--shadow-float);
    cursor: pointer;
    opacity: 0;
    transform: translateY(8px);
    pointer-events: none;
    transition:
      opacity var(--dur-med) var(--ease-out),
      transform var(--dur-med) var(--ease-out),
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  .back-to-top.visible {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .back-to-top:hover {
    background: var(--color-action-bg);
    color: var(--color-action-ink);
    border-color: var(--color-action-bg);
  }

  @media print {
    .back-to-top {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back-to-top {
      transition: none;
    }
  }
</style>
