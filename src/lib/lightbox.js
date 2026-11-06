/**
 * Lightbox for article images: click to zoom, Esc or the close button to
 * dismiss.
 *
 * Delegated globally so it works with any renderer's content. The overlay is a
 * modal dialog, so it owns focus while open: focus moves to the close button,
 * Tab is trapped inside, the page behind cannot scroll, and dismissing returns
 * focus to the image that opened it.
 */
import { getDictionary } from '$lib/i18n/index.js';

export function setupLightbox() {
	/** @type {HTMLElement | null} */
	let lastFocused = null;

	/**
	 * @param {HTMLElement | null} overlay
	 */
	function close(overlay) {
		if (!overlay) return;
		overlay.remove();
		document.removeEventListener('keydown', onKeydown);
		document.body.style.removeProperty('overflow');
		// Return focus to the trigger; otherwise the reader lands back at the
		// top of the document with no idea where they were.
		if (lastFocused && lastFocused.isConnected) lastFocused.focus();
		lastFocused = null;
	}

	/** @param {KeyboardEvent} event */
	function onKeydown(event) {
		const overlay = /** @type {HTMLElement | null} */ (
			document.querySelector('.lightbox-overlay')
		);
		if (!overlay) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			close(overlay);
			return;
		}
		if (event.key !== 'Tab') return;

		const focusables = /** @type {HTMLElement[]} */ ([
			...overlay.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')
		]);
		if (focusables.length === 0) {
			event.preventDefault();
			return;
		}
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement;

		if (!overlay.contains(active)) {
			event.preventDefault();
			first.focus();
		} else if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	/** @param {HTMLImageElement} target */
	function open(target) {
		const t = getDictionary(document.documentElement.lang);
		lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

		const overlay = document.createElement('div');
		overlay.className = 'lightbox-overlay';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', target.alt || t.lightbox.preview);

		const closeButton = document.createElement('button');
		closeButton.type = 'button';
		closeButton.className = 'lightbox-close';
		closeButton.setAttribute('aria-label', t.lightbox.close);
		closeButton.title = t.lightbox.close;
		// The glyph is decoration; the accessible name is on the button.
		closeButton.innerHTML =
			'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>';
		closeButton.addEventListener('click', () => close(overlay));

		const img = document.createElement('img');
		img.src = target.currentSrc || target.src;
		img.alt = target.alt || '';
		img.className = 'lightbox-img';

		overlay.append(img, closeButton);
		// Clicking the backdrop dismisses; clicking the image does not.
		overlay.addEventListener('click', (event) => {
			if (event.target === overlay) close(overlay);
		});

		document.body.appendChild(overlay);
		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', onKeydown);
		closeButton.focus();
	}

	/** @param {MouseEvent} event */
	function onClick(event) {
		const el = event.target;
		if (!(el instanceof HTMLImageElement)) return;
		if (!el.closest('article')) return;
		open(el);
	}

	document.addEventListener('click', onClick);

	return () => {
		document.removeEventListener('click', onClick);
		document.body.style.removeProperty('overflow');
	};
}
