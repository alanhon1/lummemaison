'use client';

// Small purple "W" shown next to a product name when it's flagged wonder
// (admin-only). Hover scales it slightly; tooltip reads "wonder".
export default function WonderMark() {
  return (
    <span
      title="wonder"
      aria-label="wonder"
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-white align-middle shrink-0 cursor-default text-[10px] font-bold leading-none transition-transform duration-150 hover:scale-125 hover:bg-purple-700"
    >
      W
    </span>
  );
}
