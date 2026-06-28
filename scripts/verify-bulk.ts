// scripts/verify-bulk.ts — run: npx tsx scripts/verify-bulk.ts
import assert from 'node:assert/strict';
import {
  BULK_THRESHOLD_CENTS, bulkDiscountCents, qualifiesForBulk, isReservedPromoCode, BULK_MARKER,
} from '../lib/checkout/bulk';

const imported = { unitCents: 100000, quantity: 1, categoryId: 'imported-products' };
const korean = { unitCents: 150000, quantity: 1, categoryId: 'korean-skincare' };

// qualifies
assert.equal(qualifiesForBulk(249999), false);
assert.equal(qualifiesForBulk(250000), true);
assert.equal(BULK_THRESHOLD_CENTS, 250000);

// 15% on everything (default applyToImported = true): (100000+150000)*0.15 = 37500
assert.equal(bulkDiscountCents([imported, korean]), 37500);

// with applyToImported = false: only korean 150000*0.15 = 22500
assert.equal(bulkDiscountCents([imported, korean], false), 22500);

// reserved marker — case/space insensitive
assert.equal(BULK_MARKER, 'BULK15');
for (const c of ['BULK15', 'bulk15', '  Bulk15 ', 'BULK15\n']) assert.equal(isReservedPromoCode(c), true);
for (const c of ['SUMMER20', '', 'BULK', 'BULK150']) assert.equal(isReservedPromoCode(c), false);

console.log('✓ verify-bulk: all assertions passed');
