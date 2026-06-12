// Shared fake "was/now" discount math. The struck-through `originalPrice` makes a
// product look discounted; the real `price` is what the customer pays.
//
// Mirrors scripts/apply-fake-discounts.ts for a STANDALONE product (its own
// single-item cluster, seed `p<id>`), so auto-applying on create yields the same
// value the bulk script would — keeping them consistent/idempotent.

const MIN_PCT = 5;
const MAX_PCT = 33;
const PRICE_LOW = 10;   // <= this → ~MAX_PCT off
const PRICE_HIGH = 120; // >= this → ~MIN_PCT off
const MAX_DISCOUNT_PRICE = 1000; // big devices ($1000+) get no fake discount

// Excluded from any fake discount: high-ticket items and the $0.5 mask sheets.
export function isExcludedFromDiscount(name: string, price: number): boolean {
  if (!(typeof price === 'number') || price <= 0) return true;
  if (price >= MAX_DISCOUNT_PRICE) return true;
  return /mask\s*sheets?/i.test(name) && price <= 1;
}

function basePct(price: number): number {
  const t = Math.min(1, Math.max(0,
    (Math.log(price) - Math.log(PRICE_LOW)) / (Math.log(PRICE_HIGH) - Math.log(PRICE_LOW))));
  return MAX_PCT - t * (MAX_PCT - MIN_PCT);
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function jitter(seed: string, J = 4): number {
  return (hashStr(seed) % (2 * J + 1)) - J;
}
function clampPct(x: number): number {
  return Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(x)));
}
function fakeOriginal(price: number, pct: number): number {
  const was = Math.ceil((price / (1 - pct / 100)) * 100) / 100;
  return was > price ? was : Math.round((price + 0.01) * 100) / 100;
}
// Snap to a .49/.99 ending above the price, without pushing the % over the cap.
function niceWas(rawWas: number, price: number): number {
  const base = Math.floor(rawWas);
  const cands: number[] = [];
  for (let k = base - 1; k <= base + 2; k++) cands.push(k + 0.49, k + 0.99);
  const above = cands.filter(c => c > price + 1e-9);
  const ok = above.filter(c => (c - price) / c * 100 <= MAX_PCT + 0.4);
  const pool = (ok.length ? ok : above).sort((a, b) => Math.abs(a - rawWas) - Math.abs(b - rawWas));
  return pool.length ? Math.round(pool[0] * 100) / 100 : Math.round((price + 0.49) * 100) / 100;
}

// Deterministic fake "was" price for a standalone product, or null if excluded.
export function computeStandaloneOriginal(price: number, id: number): number | null {
  if (isExcludedFromDiscount('', price)) return null;
  const pct = clampPct(basePct(price) + jitter(`p${id}`));
  return niceWas(fakeOriginal(price, pct), price);
}

// Displayed integer percent off, or 0 when there's no valid sale.
export function discountPercent(price: number, originalPrice: number | undefined): number {
  if (typeof originalPrice !== 'number' || originalPrice <= price || price <= 0) return 0;
  return Math.round((originalPrice - price) / originalPrice * 100);
}
