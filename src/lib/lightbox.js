/**
 * Lightbox for article images: click to zoom, click/Esc to close.
 * Delegated globally so it works with mdsvex-rendered content.
 */
export function setupLightbox() {
  /**
   * @param {HTMLElement | null} overlay
   */
  function close(overlay) {
    overlay?.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  /**
   * @param {KeyboardEvent} event
   */
  function onKeydown(event) {
    if (event.key === 'Escape') {
      close(/** @type {HTMLElement | null} */ (document.querySelector('.lightbox-overlay')));
    }
  }

  /**
   * @param {MouseEvent} event
   */
  function onClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) return;
    if (!target.closest('article')) return;

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', target.alt || 'Image preview');

    const img = document.createElement('img');
    img.src = target.currentSrc || target.src;
    img.alt = target.alt || '';
    img.className = 'lightbox-img';

    overlay.appendChild(img);
    overlay.addEventListener('click', () => close(overlay));
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKeydown);
  }

  document.addEventListener('click', onClick);

  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKeydown);
  };
}
