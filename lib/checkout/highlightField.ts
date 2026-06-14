'use client';

/**
 * Scrolls an element into view and briefly flashes it, so a customer always
 * sees *where* an unmet checkout requirement is. Critical on mobile, where the
 * blocking field/section is usually off-screen when they tap the CTA.
 *
 * Pass `focus: true` for form inputs so the on-screen keyboard opens on the
 * field that needs attention. Harmless for non-focusable containers.
 */
export function highlightField(
  el: HTMLElement | null,
  opts: { focus?: boolean } = {},
) {
  if (!el) return;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });

  // Restart the animation if it's already on the element.
  el.classList.remove('checkout-highlight');
  void el.offsetWidth; // force reflow
  el.classList.add('checkout-highlight');
  window.setTimeout(() => el.classList.remove('checkout-highlight'), 1300);

  if (opts.focus && typeof el.focus === 'function') {
    el.focus({ preventScroll: true });
  }
}
