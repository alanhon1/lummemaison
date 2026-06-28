// lib/checkout/bulk.ts
// Pure, framework-agnostic bulk-discount logic. No Supabase, no I/O — unit-
// verified by scripts/verify-bulk.ts.

export const BULK_THRESHOLD_CENTS = 250_000; // $2,500
export const BULK_RATE = 0.15;
export const APPLY_TO_IMPORTED = true; // flip to false later to exclude imports

// Catalogue category identifier(s) treated as "imported / thin-margin". Used
// only when APPLY_TO_IMPORTED is false. Compared case-insensitively.
export const IMPORTED_CATEGORY_IDS = ['imported-products'];

// The server-only marker written to bulk-quote orders' discount_code. It is NOT
// a redeemable promo code (see isReservedPromoCode).
export const BULK_MARKER = 'BULK15';

export interface BulkLine {
  unitCents: number;
  quantity: number;
  categoryId: string | null;
}

const round = (n: number) => Math.round(n);
const lineTotal = (l: BulkLine) => round(l.unitCents) * round(l.quantity);

export function qualifiesForBulk(subtotalCents: number): boolean {
  return subtotalCents >= BULK_THRESHOLD_CENTS;
}

// 15% off. When applyToImported is false, imported lines are excluded from the
// discount base (they still counted toward the threshold elsewhere).
export function bulkDiscountCents(lines: BulkLine[], applyToImported = APPLY_TO_IMPORTED): number {
  const excluded = new Set(IMPORTED_CATEGORY_IDS.map(c => c.toLowerCase()));
  const base = lines
    .filter(l => applyToImported || !excluded.has(String(l.categoryId ?? '').toLowerCase()))
    .reduce((s, l) => s + lineTotal(l), 0);
  return round(base * BULK_RATE);
}

const RESERVED = new Set([BULK_MARKER]);
export function isReservedPromoCode(code: string): boolean {
  return RESERVED.has((code ?? '').trim().toUpperCase());
}
