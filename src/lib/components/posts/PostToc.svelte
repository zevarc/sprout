<script>
  import { pickActiveIndex, scrollTarget } from '$lib/scroll-spy.js';

  /**
   * Table of contents for an article body.
   *
   * Owns its own scroll spy: one rAF-throttled listener, cached heading offsets,
   * and a sliding indicator, so the highlight follows the section the reader is
   * in without re-reading layout on every scroll event.
   *
   * @type {{
   *   headings?: import('$lib/reading').TocItem[],
   *   label?: string,
   *   compact?: boolean
   * }}
   */
  let { headings = [], label = 'Contents', compact = false } = $props();

  /** Sticky header height + breathing room. Mirrors `html { scroll-padding-top }`. */
  const OFFSET = 80;
  /** Ignore the spy while a click-driven smooth scroll is still running. */
  const FREEZE_MS = 600;

  let activeId = $state('');
  /** Falls back to the opening section, so SSR renders it as current. */
  const currentId = $derived(activeId || headings[0]?.id || '');
  let indicator = $state({ top: 0, height: 0 });
  let ready = $state(false);

  /** @type {HTMLDivElement | null} */
  let scrollBox = null;

  /** @type {number[]} */
  let tops = [];
  let freezeUntil = 0;
  let frame = 0;

  const activeIndex = $derived(headings.findIndex((h) => h.id === currentId));

  /** Level-2 headings are numbered; deeper ones get a dot. */
  const numbers = $derived.by(() => {
    /** @type {Map<string, number>} */
    const map = new Map();
    let n = 0;
    for (const h of headings) {
      if (h.level === 2) map.set(h.id, ++n);
    }
    return map;
  });

  function measure() {
    tops = headings.map((h) => {
      const el = document.getElementById(h.id);
      return el ? el.getBoundingClientRect().top + window.scrollY : Number.POSITIVE_INFINITY;
    });
  }

  function sync() {
    frame = 0;
    if (performance.now() < freezeUntil) return;
    if (tops.length === 0) measure();
    const next = headings[pickActiveIndex(tops, window.scrollY + OFFSET)]?.id;
    if (next && next !== activeId) activeId = next;
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  }

  function releaseFreeze() {
    freezeUntil = 0;
  }

  /** @param {{ id: string }} heading */
  function go(heading) {
    const el = document.getElementById(heading.id);
    if (!el) return;

    measure();
    const index = headings.findIndex((h) => h.id === heading.id);
    const top = scrollTarget(tops[index] ?? el.getBoundingClientRect().top + window.scrollY, OFFSET);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    activeId = heading.id;
    freezeUntil = reduced ? 0 : performance.now() + FREEZE_MS;

    if (window.location.hash !== `#${heading.id}`) {
      history.replaceState(null, '', `#${heading.id}`);
    }

    // On mobile the list lives in a <details>: close it once a section is picked.
    const details = el.ownerDocument.querySelector('details.toc-mobile[open]');
    if (details) details.removeAttribute('open');
  }

  $effect(() => {
    measure();
    sync();

    const prose = document.querySelector('.prose');
    const observer = new ResizeObserver(() => {
      measure();
      schedule();
    });
    if (prose) observer.observe(prose);
    if (scrollBox) observer.observe(scrollBox);

    // Webfonts change line heights, which moves every heading.
    document.fonts?.ready.then(() => {
      measure();
      schedule();
    });

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('wheel', releaseFreeze, { passive: true });
    window.addEventListener('touchstart', releaseFreeze, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('wheel', releaseFreeze);
      window.removeEventListener('touchstart', releaseFreeze);
      if (frame) cancelAnimationFrame(frame);
    };
  });

  // Keep the indicator and the active row inside the scroll box.
  $effect(() => {
    const id = currentId;
    if (!scrollBox || !id) return;
    const link = scrollBox.querySelector(`a[data-id="${CSS.escape(id)}"]`);
    if (!(link instanceof HTMLElement)) {
      ready = false;
      return;
    }

    indicator = { top: link.offsetTop, height: link.offsetHeight };
    ready = true;

    const viewTop = scrollBox.scrollTop;
    const viewBottom = viewTop + scrollBox.clientHeight;
    const linkTop = link.offsetTop;
    const linkBottom = linkTop + link.offsetHeight;

    if (linkTop < viewTop + 8) {
      scrollBox.scrollTo({ top: Math.max(0, linkTop - 8), behavior: 'smooth' });
    } else if (linkBottom > viewBottom - 8) {
      scrollBox.scrollTo({ top: linkBottom - scrollBox.clientHeight + 8, behavior: 'smooth' });
    }
  });
</script>

<nav class="toc" class:compact aria-label={label}>
  <p class="toc-title">{label}</p>
  <div class="toc-scroll" bind:this={scrollBox}>
    <div
      class="toc-indicator"
      class:visible={ready && indicator.height > 0}
      style:top={`${indicator.top}px`}
      style:height={`${indicator.height}px`}
      aria-hidden="true"
    ></div>
    <ol class="toc-list">
      {#each headings as h, i (h.id)}
        <li
          class="toc-item"
          class:active={h.id === currentId}
          class:read={i < activeIndex}
          data-level={h.level}
        >
          <a
            href={`#${h.id}`}
            data-id={h.id}
            aria-current={h.id === currentId ? 'location' : undefined}
            onclick={(event) => {
              event.preventDefault();
              go(h);
            }}
          >
            <span class="toc-badge" aria-hidden="true">
              {#if h.level === 2}
                <span class="toc-num">{numbers.get(h.id)}</span>
              {:else}
                <span class="toc-dot" class:small={h.level >= 4}></span>
              {/if}
            </span>
            <span class="toc-label" title={h.text}>{h.text}</span>
          </a>
        </li>
      {/each}
    </ol>
  </div>
</nav>

<style>
  .toc {
    font-size: 0.86rem;
    line-height: 1.35;
  }

  .toc-title {
    margin: 0 0 10px;
    padding-left: 10px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-text-faint);
  }

  .toc-scroll {
    position: relative;
    max-height: calc(100vh - 170px);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    /* No fade mask: with a short list it made the last row look clipped, and
       with a long one the thin scrollbar already says there is more. */
  }

  .compact .toc-scroll {
    max-height: min(60vh, 420px);
  }

  .toc-list {
    position: relative;
    z-index: 1;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .toc-indicator {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 0;
    border-radius: var(--radius-md);
    background: var(--color-toc-pill);
    opacity: 0;
    transition:
      top var(--dur-med) var(--ease-out),
      height var(--dur-med) var(--ease-out),
      opacity var(--dur-fast) var(--ease-out);
  }

  .toc-indicator.visible {
    opacity: 1;
  }

  .toc-item a {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 2.1rem;
    padding: 6px 10px;
    border: 0;
    border-radius: var(--radius-md);
    color: var(--color-toc-unread);
    text-decoration: none;
    transition:
      color var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }

  .toc-item[data-level='3'] a {
    padding-left: 20px;
  }

  .toc-item[data-level='4'] a {
    padding-left: 32px;
  }

  .toc-item a:hover {
    color: var(--color-toc-active);
    transform: translateX(1px);
  }

  .toc-item.read a {
    color: var(--color-toc-read);
  }

  .toc-item.active a {
    color: var(--color-toc-active);
    font-weight: 600;
  }

  .toc-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
  }

  .toc-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: var(--radius-sm);
    background: var(--color-toc-badge);
    color: var(--color-toc-badge-ink);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 700;
    line-height: 1;
  }

  .toc-dot {
    width: 5px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--color-bud) 26%, var(--color-toc-track));
  }

  .toc-dot.small {
    width: 4px;
    height: 4px;
  }

  .toc-item.read .toc-dot,
  .toc-item.active .toc-dot {
    background: var(--color-bud);
  }

  .toc-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toc-item.active .toc-num {
    background: var(--color-bud-deep);
    color: var(--color-paper);
  }

  @media (prefers-reduced-motion: reduce) {
    .toc-indicator,
    .toc-item a {
      transition: none;
    }
  }
</style>
