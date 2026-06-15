'use client';

// Small admin-only marks shown next to a product name, mirroring WonderMark.
// Hover scales slightly; the tooltip spells out the full meaning so the owner
// doesn't have to open each product to remember why it's blocked.

// Black "N" — product is flagged Not for sale (purchase disabled).
export function NotForSaleMark() {
  return (
    <span
      title="Not for sale"
      aria-label="Not for sale"
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-charcoal text-white align-middle shrink-0 cursor-default text-[10px] font-bold leading-none transition-transform duration-150 hover:scale-125"
    >
      N
    </span>
  );
}

// Red "O" — product is flagged Out of stock (purchase disabled).
export function OutOfStockMark() {
  return (
    <span
      title="Out of stock"
      aria-label="Out of stock"
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-600 text-white align-middle shrink-0 cursor-default text-[10px] font-bold leading-none transition-transform duration-150 hover:scale-125 hover:bg-rose-700"
    >
      O
    </span>
  );
}
