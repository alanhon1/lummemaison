// Ad-hoc verification of lib/checkout/promo.ts against the MAISON15 handoff
// test table. Run: npx tsx scripts/verify-promo.ts
import { applyPromo, type PromoRule, type PromoLine } from '../lib/checkout/promo';

const NOW = new Date('2026-06-24T00:00:00Z');

const MAISON15: PromoRule = {
  discountType: 'percent', discountValue: 15, minOrderCents: 250000,
  maxUses: null, usedCount: 0, active: true, expiresAt: null,
  includeShipping: false, flatShippingCents: 10000, excludeCategoryIds: ['imported-products'],
};
const PRIVATE: PromoRule = {
  discountType: 'percent', discountValue: 15, minOrderCents: 0,
  maxUses: null, usedCount: 0, active: true, expiresAt: null,
  includeShipping: false, flatShippingCents: null, excludeCategoryIds: [],
};

// normal shipping for these carts is $35 (3500) unless stated.
const korean = (cents: number): PromoLine => ({ unitCents: cents, quantity: 1, categoryId: 'korean-something' });
const imported = (cents: number): PromoLine => ({ unitCents: cents, quantity: 1, categoryId: 'imported-products' });

let pass = 0, fail = 0;
function check(name: string, got: number, want: number) {
  const ok = got === want;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${got} want=${want}`);
  ok ? pass++ : fail++;
}

// 1. $2,000 Korean + MAISON15 → below minimum → rejected (no discount, normal $35)
let r = applyPromo(MAISON15, [korean(200000)], 3500, NOW);
check('1 below-min: discount', r.discountCents, 0);
check('1 below-min: shipping', r.shippingCents, 3500);

// 2. $3,000 Korean + MAISON15 → -$450 (15%), shipping $100, total $2,650
r = applyPromo(MAISON15, [korean(300000)], 3500, NOW);
check('2 discount', r.discountCents, 45000);
check('2 shipping', r.shippingCents, 10000);
check('2 total', 300000 + r.shippingCents - r.discountCents, 265000);

// 3. $3,000 = $2,000 Korean + $1,000 imported → 15% only on $2,000 = -$300, ship $100, total $2,800
r = applyPromo(MAISON15, [korean(200000), imported(100000)], 3500, NOW);
check('3 discount (excl imports)', r.discountCents, 30000);
check('3 shipping', r.shippingCents, 10000);
check('3 total', 300000 + r.shippingCents - r.discountCents, 280000);

// 4. $5,000 Korean (case-insensitive handled by caller) → -$750, ship $100
r = applyPromo(MAISON15, [korean(500000)], 3500, NOW);
check('4 discount', r.discountCents, 75000);
check('4 shipping', r.shippingCents, 10000);

// 5. $400 any + PRIVATE → -$60 (15%), shipping normal $35, no minimum
r = applyPromo(PRIVATE, [korean(40000)], 3500, NOW);
check('5 discount', r.discountCents, 6000);
check('5 shipping (normal kept)', r.shippingCents, 3500);

// 6. $6,000 mixed + PRIVATE → 15% off everything, shipping $35
r = applyPromo(PRIVATE, [korean(400000), imported(200000)], 3500, NOW);
check('6 discount (all items)', r.discountCents, 90000);
check('6 shipping', r.shippingCents, 3500);

// Edge: all-imports cart >= min → qualifies (min counts imports) but 0 discount, ship $100
r = applyPromo(MAISON15, [imported(300000)], 3500, NOW);
check('edge all-imports: discount', r.discountCents, 0);
check('edge all-imports: shipping override', r.shippingCents, 10000);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
