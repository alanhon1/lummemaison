'use client';

// Small yellow "S" shown next to a product whose stock was arbitrarily assigned
// (a placeholder number entered in bulk, not a real count). Admin-only. Hover
// scales it slightly and the tooltip explains it. The mark clears automatically
// once a real stock count is set or stock is added (see lib/products/stock.ts
// and the inbound actions). The DB column is still `wonder` internally.
export default function WonderMark() {
  return (
    <span
      title="Arbitrarily assigned stock"
      aria-label="Arbitrarily assigned stock"
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-amber-950 align-middle shrink-0 cursor-default text-[10px] font-bold leading-none transition-transform duration-150 hover:scale-125 hover:bg-amber-500"
    >
      S
    </span>
  );
}
