# Bulk-Order Quote Flow + Wise Single-Source + Receipt Header — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At cart subtotal ≥ $2,500, offer customers a pay-now path or a 15%-off team-quoted path (`quote_pending → awaiting_payment → payment_verified`), unify Wise bank details into one source shared by site + email, and trim the receipt header.

**Architecture:** Pure, testable bulk-discount logic in `lib/checkout/bulk.ts`; the payment step shows a popup + two cards when qualified; Option B writes a `quote_pending` order via a server action (no payment) and emails the team + customer; the team sets shipping and "opens payment" (→ `awaiting_payment`) so the customer pays in-app; Wise details live only in `lib/checkout/wisePayment.ts`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4, Supabase (service client), next-intl (en/ru), Nodemailer. **No test framework exists** — pure logic is verified with `tsx` scripts + `node:assert/strict` (the pattern the deleted `scripts/verify-promo.ts` used); UI/server/integration is verified with `npx tsc --noEmit`, `next build`, and manual click-tests.

## Global Constraints

- Threshold = **250000 cents ($2,500)**; bulk rate = **0.15**; `APPLY_TO_IMPORTED = true` (default; keep the switch).
- Option A uses the **existing** `computeShippingCents` ($35, or $65 for US without a valid 9-digit FedEx account) — **never hardcode $35**. The Option A card must show the customer's **real** shipping.
- `BULK15` is a **server-only reserved marker** — it must be **rejected** by the promo redemption/validation path and never redeemable via the promo box.
- Discount is represented as `total = subtotal − discount + shipping` (no new `discount_cents` column), matching the existing promo system.
- Wise bank details have **one source**: `lib/checkout/wisePayment.ts`. Site + order email both import it; the `WISE_*` env values are removed.
- Money values are integer **cents**. Customer-facing strings go through next-intl (en + ru); bank field **values** are literal (never translated).
- Mobile-first. Match existing Tailwind tokens (charcoal / gold / cream / bone / mist), not the reference JSX's stone/amber palette.
- After every task: `npx tsc --noEmit` must pass before commit.

---

## File Structure

**New**
- `lib/checkout/bulk.ts` — pure bulk-discount logic + `BULK_MARKER` + `isReservedPromoCode`.
- `lib/checkout/wisePayment.ts` — single-source Korestetics Global bank details + send steps keys.
- `scripts/verify-bulk.ts` — `tsx` assertions for bulk logic + reserved-code guard.
- `supabase/migrations/030_quote_statuses.sql` — extend the orders `status` CHECK.
- `components/checkout/BulkDiscountGate.tsx` — popup + two-option cards (client).
- `components/checkout/WisePaymentInfo.tsx` — the new Wise section (shared by checkout + customer pay page).
- `components/account/OrderPaymentSection.tsx` — in-app pay UI for `awaiting_payment` orders.
- `components/admin/QuoteShippingPanel.tsx` — admin "set shipping & open payment" for quote orders.

**Modify**
- `app/[locale]/checkout/actions.ts` — `requestBulkQuoteAction`, quote branch in `createOrder`, reserved-code guard in `promoDiscountCents`/`validatePromoCode`, an `attachOrderPaymentProof` action.
- `components/checkout/PaymentStep.tsx` — render `BulkDiscountGate`; swap the Wise block for `WisePaymentInfo`.
- `lib/orders/status.ts` — add `quote_pending`, `awaiting_payment`.
- `app/manzura/orders/actions.ts` — add the two statuses to `VALID_STATUSES`; `openOrderPayment` action; transition guard.
- `app/manzura/orders/page.tsx` — status badges + filter chips.
- `app/manzura/orders/[id]/page.tsx` — render `QuoteShippingPanel` when `quote_pending`.
- `app/[locale]/account/orders/[seq]/page.tsx` — render `OrderPaymentSection` when `awaiting_payment`.
- `components/admin/OrderReceiptModal.tsx` — header line.
- `lib/email/templates.ts` — Wise fields from `wisePayment.ts`; new quote/payment-open templates.
- `lib/email/sendOrderEmails.ts` — `sendQuoteRequestEmail`, `sendQuoteAckEmail`, `sendPaymentOpenEmail`.
- `messages/en.json`, `messages/ru.json` — new keys.

**Assets**
- `lumee3/wise-1..4.jpeg` → `public/images/wise/wise-1..4.jpeg`.

---

## Phase 1 — Section B quick wins (independent, low risk)

### Task 1: Receipt header — drop the `No:` label

**Files:**
- Modify: `components/admin/OrderReceiptModal.tsx:49`

**Interfaces:** none changed.

- [ ] **Step 1: Edit the header line.** In `buildPackagingText` (line 48-53), change:

```ts
  const lines: string[] = [
    `${props.orderNumber}`,
    `Name: ${props.customerName}`,
    '',
    ...props.items.flatMap(it => [itemName(it), `Quantity: ${it.quantity}`, '']),
  ];
```

(Was `` `No:   ${props.orderNumber}` ``.)

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` → Expected: no errors.
- [ ] **Step 3: Manual check.** Open an admin order → Receipt → Copy. First line is `SGL #00xxxx` (no `No:`).
- [ ] **Step 4: Commit.**

```bash
git add components/admin/OrderReceiptModal.tsx
git commit -m "fix(admin/receipt): show only the order number in the copy header"
```

### Task 2: Wise single-source constant + images

**Files:**
- Create: `lib/checkout/wisePayment.ts`
- Move: `lumee3/wise-1.jpeg`..`wise-4.jpeg` → `public/images/wise/`

**Interfaces:**
- Produces: `WISE_PAYMENT` (`{ bankFields: {label,value,mono?}[]; receiverName: string }`), `WISE_IMAGES` (`{src,captionKey}[]`).

- [ ] **Step 1: Create the constant.**

```ts
// lib/checkout/wisePayment.ts
// SINGLE SOURCE OF TRUTH for the Korestetics Global bank details. Imported by
// the on-site Wise section (components/checkout/WisePaymentInfo.tsx) AND the
// order instruction email (lib/email/templates.ts). Change the account here and
// both surfaces update. Plain data — safe to import from client and server.

export interface WiseField {
  label: string; // English label (also a translation key suffix where i18n'd)
  value: string; // literal — NEVER translated
  mono?: boolean;
}

export const WISE_PAYMENT = {
  receiverName: 'KORESTETICS GLOBAL',
  bankFields: [
    { label: 'SWIFT code', value: 'IBKOKRSE', mono: true },
    { label: 'Bank name', value: 'Industrial Bank of Korea' },
    { label: 'Bank account', value: '67704136004017', mono: true },
    { label: "Receiver's name", value: 'KORESTETICS GLOBAL' },
    { label: 'Address', value: 'Songdogwahak-ro-80' },
    { label: 'City', value: 'Yeonsu-gu' },
    { label: 'State', value: 'Incheon' },
    { label: 'Country', value: 'Republic of Korea' },
    { label: 'Postal code', value: '21984', mono: true },
    { label: 'Tel', value: '+82-10-2942-7225', mono: true },
    { label: 'Email', value: 'sg@koresteticsglobal.com', mono: true },
  ] as WiseField[],
} as const;

// 6 send-instruction steps; text is i18n'd by key (checkout.wise.steps.*).
export const WISE_STEP_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

export const WISE_IMAGES = [
  { src: '/images/wise/wise-1.jpeg', captionKey: 'img1' },
  { src: '/images/wise/wise-2.jpeg', captionKey: 'img2' },
  { src: '/images/wise/wise-3.jpeg', captionKey: 'img3' },
  { src: '/images/wise/wise-4.jpeg', captionKey: 'img4' },
] as const;
```

- [ ] **Step 2: Move the images.**

```bash
mkdir -p public/images/wise
git mv lumee3/wise-1.jpeg public/images/wise/wise-1.jpeg
git mv lumee3/wise-2.jpeg public/images/wise/wise-2.jpeg
git mv lumee3/wise-3.jpeg public/images/wise/wise-3.jpeg
git mv lumee3/wise-4.jpeg public/images/wise/wise-4.jpeg
```

(If `lumee3/` is untracked, use `mkdir -p public/images/wise && mv` instead of `git mv`.)

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` → no errors.
- [ ] **Step 4: Commit.**

```bash
git add lib/checkout/wisePayment.ts public/images/wise
git commit -m "feat(checkout): single-source Korestetics Global Wise details + screenshots"
```

### Task 3: New on-site Wise section component

**Files:**
- Create: `components/checkout/WisePaymentInfo.tsx`
- Modify: `messages/en.json`, `messages/ru.json` (add `checkout.wise.*`)

**Interfaces:**
- Consumes: `WISE_PAYMENT`, `WISE_STEP_KEYS`, `WISE_IMAGES` from `@/lib/checkout/wisePayment`; existing `CopyButton` from `./CopyButton`.
- Produces: default export `WisePaymentInfo` (no props).

- [ ] **Step 1: Add i18n keys.** In `messages/en.json` under `"checkout"`, add a `"wise"` object:

```json
"wise": {
  "heading": "Payment Instructions (Important)",
  "kicker": "Wise Transfer",
  "steps": {
    "s1": "Open Wise and tap \"Send\".",
    "s2": "Enter the amount and choose the currency (send from USD to KRW).",
    "s3": "Add us as the recipient, choose \"Business\", and enter the details below.",
    "s4": "At \"How would you like to pay?\" choose Bank transfer — NOT card (the card fee is high).",
    "s5": "Wise shows you their bank details and a reference number. Open your own bank app, send the money there, and include the reference number so they can match your payment.",
    "s6": "Done — Wise notifies you once they receive it."
  },
  "reason": "For the transfer reason, select \"Pay for goods and services\".",
  "screenshotsTitle": "Step-by-step screenshots",
  "img1": "1 · Recipient details",
  "img2": "2 · Recipient address",
  "img3": "3 · Cover the fee",
  "img4": "4 · Goods & services",
  "bankTitle": "Bank details",
  "copyAll": "Copy all"
}
```

Add the Russian equivalents under `messages/ru.json` → `"checkout"."wise"` (translate the prose; keep the JSON keys identical).

- [ ] **Step 2: Create the component.**

```tsx
// components/checkout/WisePaymentInfo.tsx
'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { WISE_PAYMENT, WISE_STEP_KEYS, WISE_IMAGES } from '@/lib/checkout/wisePayment';
import CopyButton from './CopyButton';

export default function WisePaymentInfo() {
  const t = useTranslations('checkout.wise');
  const allText = WISE_PAYMENT.bankFields.map(f => `${f.label}: ${f.value}`).join('\n');

  return (
    <article className="bg-white border border-bone rounded-lg p-5 md:p-6 hover-glow">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-dark mb-1">{t('kicker')}</p>
        <h2 className="font-display italic text-xl text-charcoal">{t('heading')}</h2>
      </header>
      <div className="h-px w-12 bg-gold-dark mb-4" aria-hidden />

      <ol className="mb-6 space-y-3">
        {WISE_STEP_KEYS.map((k, i) => (
          <li key={k} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-dark text-xs font-semibold text-white">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed text-charcoal">{t(`steps.${k}`)}</p>
          </li>
        ))}
      </ol>

      <div className="mb-6 rounded-md border border-bone bg-cream px-4 py-3 text-sm text-charcoal">
        {t('reason')}
      </div>

      <p className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">{t('screenshotsTitle')}</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {WISE_IMAGES.map(img => (
          <figure key={img.src} className="overflow-hidden rounded-md border border-bone bg-cream">
            <Image
              src={img.src}
              alt={t(img.captionKey)}
              width={270}
              height={570}
              className="aspect-[9/19] w-full object-cover"
            />
            <figcaption className="px-2 py-1.5 text-[11px] text-mist">{t(img.captionKey)}</figcaption>
          </figure>
        ))}
      </div>

      <div className="rounded-md border border-bone bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-charcoal">{t('bankTitle')}</h3>
          <CopyButton value={allText} ariaLabel={t('copyAll')} />
        </div>
        <dl className="divide-y divide-bone">
          {WISE_PAYMENT.bankFields.map(f => (
            <div key={f.label} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <dt className="text-[11px] uppercase tracking-wide text-mist">{f.label}</dt>
                <dd className={`text-sm text-charcoal ${f.mono ? 'font-mono break-all' : ''}`}>{f.value}</dd>
              </div>
              <CopyButton value={f.value} ariaLabel={`Copy ${f.label}`} />
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
```

> Verify `CopyButton`'s prop names match (the existing `PaymentStep` uses `<CopyButton value=... ariaLabel=... />`). If different, adapt this usage to the real signature.

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` → no errors.
- [ ] **Step 4: Commit.**

```bash
git add components/checkout/WisePaymentInfo.tsx messages/en.json messages/ru.json
git commit -m "feat(checkout): Wise payment-info section (steps + screenshots + copyable bank details)"
```

### Task 4: Swap the Wise block in PaymentStep + email Wise from the constant

**Files:**
- Modify: `components/checkout/PaymentStep.tsx` (the Wise `<article>`, ~lines 231-271, and the `wiseFields` builder ~183-193)
- Modify: `lib/email/templates.ts:277-286` (the `wiseFields` array)

**Interfaces:**
- Consumes: `WisePaymentInfo`, `WISE_PAYMENT`.

- [ ] **Step 1: Replace the Wise article in PaymentStep.** Remove the `wiseFields` array (lines ~183-193) and the entire Wise `<article>…</article>` block (the section headed `{t('payment.wise.heading')}`), and render the new component in its place:

```tsx
import WisePaymentInfo from './WisePaymentInfo';
// …
{/* Wise */}
<WisePaymentInfo />
```

Leave the USDT `<article>` and everything else untouched. Remove now-unused `payment.wise.*` reads only if nothing else uses them (leave the JSON keys; harmless).

- [ ] **Step 2: Point the email at the constant.** In `lib/email/templates.ts`, replace the env-driven `wiseFields` (lines 277-286) with the shared constant:

```ts
import { WISE_PAYMENT } from '@/lib/checkout/wisePayment';
// …
const wiseFields = WISE_PAYMENT.bankFields.map(f => ({ label: f.label, value: f.value }));
```

Delete the `envValue('WISE_*')` calls for these fields. (Leave unrelated `envValue` usages, e.g. USDT, intact.)

- [ ] **Step 3: Typecheck + build.** `npx tsc --noEmit` then `npx next build` → both succeed.
- [ ] **Step 4: Manual check.** Checkout payment page shows the new Wise section with the Korestetics Global account; a freshly-sent order email shows the **same** account values.
- [ ] **Step 5: Commit.**

```bash
git add components/checkout/PaymentStep.tsx lib/email/templates.ts
git commit -m "feat(checkout/email): use single-source Wise details on site + order email"
```

> Follow-up (manual, not code): remove the now-dead `WISE_*` env vars from Vercel after deploy.

---

## Phase 2 — Bulk pure logic + BULK15 guard

### Task 5: `lib/checkout/bulk.ts` + verify script

**Files:**
- Create: `lib/checkout/bulk.ts`
- Create: `scripts/verify-bulk.ts`

**Interfaces:**
- Produces: `BULK_THRESHOLD_CENTS`, `BULK_RATE`, `APPLY_TO_IMPORTED`, `BULK_MARKER`, `IMPORTED_CATEGORY_IDS`, `BulkLine`, `bulkDiscountCents(lines, applyToImported?)`, `qualifiesForBulk(subtotalCents)`, `isReservedPromoCode(code)`.

- [ ] **Step 1: Write the failing verify script.**

```ts
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
```

- [ ] **Step 2: Run it to verify it fails.** Run: `npx tsx scripts/verify-bulk.ts` → Expected: FAIL (`Cannot find module '../lib/checkout/bulk'`).
- [ ] **Step 3: Implement `bulk.ts`.**

```ts
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
```

- [ ] **Step 4: Run the verify script.** Run: `npx tsx scripts/verify-bulk.ts` → Expected: `✓ verify-bulk: all assertions passed`.
- [ ] **Step 5: Typecheck.** `npx tsc --noEmit` → no errors.
- [ ] **Step 6: Commit.**

```bash
git add lib/checkout/bulk.ts scripts/verify-bulk.ts
git commit -m "feat(checkout): pure bulk-discount logic + BULK15 reserved marker (verified)"
```

### Task 6: Reject `BULK15` in the promo redemption/validation path

**Files:**
- Modify: `app/[locale]/checkout/actions.ts` (`promoDiscountCents` ~340-361, `validatePromoCode` ~365-372)

**Interfaces:**
- Consumes: `isReservedPromoCode` from `@/lib/checkout/bulk`.

- [ ] **Step 1: Guard `promoDiscountCents`.** At the very top of the function body (before any DB lookup), add:

```ts
import { isReservedPromoCode } from '@/lib/checkout/bulk';
// inside promoDiscountCents(admin, code, subtotal, shipping):
if (isReservedPromoCode(code)) return 0; // BULK15 is server-only — never redeemable
```

- [ ] **Step 2: Guard `validatePromoCode`.** At the top of its body, reject reserved codes with the same "not a valid code" shape the function already returns for unknown codes:

```ts
if (isReservedPromoCode(code)) {
  return { ok: false, message: 'This code is not valid.' }; // match the existing invalid-code return shape
}
```

> Open the function and copy its exact invalid-code return object (field names) so this matches; the guard must run before the DB query.

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` → no errors.
- [ ] **Step 4: Manual check.** With a cart under $2,500, enter `BULK15` (and `bulk15`) in the promo box → rejected as invalid, $0 discount. Enter a real active promo → still works.
- [ ] **Step 5: Commit.**

```bash
git add app/[locale]/checkout/actions.ts
git commit -m "fix(checkout/security): reject reserved BULK15 in promo redemption + validation"
```

---

## Phase 3 — Order statuses + migration

### Task 7: Add `quote_pending` and `awaiting_payment`

**Files:**
- Modify: `lib/orders/status.ts`
- Create: `supabase/migrations/030_quote_statuses.sql`
- Modify: `app/manzura/orders/actions.ts` (`VALID_STATUSES` ~29-36)
- Modify: `app/manzura/orders/page.tsx` (`statusBadge` ~43-53, filter chips ~58-66)

**Interfaces:**
- Produces: extended `OrderStatus` union including `'quote_pending' | 'awaiting_payment'`.

- [ ] **Step 1: Extend the type.** In `lib/orders/status.ts`, add the two values to `OrderStatus` (keep `ORDER_STAGES` as the 5 fulfilment stages — the two new statuses are pre-fulfilment and handled explicitly, NOT added to `ORDER_STAGES`):

```ts
export type OrderStatus =
  | 'quote_pending'
  | 'awaiting_payment'
  | 'order_received'
  | 'payment_verified'
  | 'packaging'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
```

Add a helper used by the admin/customer UI:

```ts
export function isQuoteStatus(status: string): boolean {
  return status === 'quote_pending' || status === 'awaiting_payment';
}
```

- [ ] **Step 2: Write the migration.**

```sql
-- supabase/migrations/030_quote_statuses.sql
-- Allow the two bulk-quote statuses on orders.status. quote_pending: created via
-- the bulk Option B (no payment). awaiting_payment: team has set shipping/total
-- and opened payment so the customer can pay in-app.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in (
    'quote_pending', 'awaiting_payment',
    'order_received', 'payment_verified', 'packaging', 'shipped', 'delivered', 'cancelled'
  ));
```

> Run manually in the Supabase SQL editor (project migration workflow). Confirm the existing constraint name first with: `select conname from pg_constraint where conrelid = 'public.orders'::regclass and contype = 'c';` and use that name in `drop constraint`.

- [ ] **Step 3: Extend `VALID_STATUSES`.** In `app/manzura/orders/actions.ts`, add both values to the `new Set<OrderStatus>([...])`.

- [ ] **Step 4: Badges + filters.** In `app/manzura/orders/page.tsx`, add to the `statusBadge()` map:

```ts
quote_pending: 'Quote pending',
awaiting_payment: 'Awaiting payment',
```

and add two filter chips (`quote_pending`, `awaiting_payment`) alongside the existing ones.

- [ ] **Step 5: Typecheck.** `npx tsc --noEmit` → no errors (the `OrderStatus` widening may surface exhaustive `switch`/map sites — fill them in for the two new values).
- [ ] **Step 6: Apply migration + commit.** Run the SQL in Supabase, then:

```bash
git add lib/orders/status.ts supabase/migrations/030_quote_statuses.sql app/manzura/orders/actions.ts app/manzura/orders/page.tsx
git commit -m "feat(orders): add quote_pending + awaiting_payment statuses"
```

---

## Phase 4 — Option B order creation + emails

### Task 8: `requestBulkQuoteAction` + quote branch in `createOrder`

**Files:**
- Modify: `app/[locale]/checkout/actions.ts` (`createOrder` ~119-334; new exported action)

**Interfaces:**
- Consumes: `bulkDiscountCents`, `qualifiesForBulk`, `BULK_MARKER` from `@/lib/checkout/bulk`; existing `CreateOrderInput`, `computeShippingCents`.
- Produces: `requestBulkQuoteAction(payload: string): Promise<CreateOrderResult>` (mirrors `placeOrderAction`'s payload contract), and an internal `quote` branch in `createOrder`.

- [ ] **Step 1: Add a `quote` option to `createOrder`.** Change the signature to `createOrder(input: CreateOrderInput, opts?: { quote?: boolean })`. Inside, after the availability + disclaimer + shipping-completeness checks (keep those), branch:
  - Compute `subtotal` as today. Build `BulkLine[]` from `input.items` (`unitCents: l.unit_cents, quantity: l.quantity, categoryId: categoryId for l.product_id`). Reuse the live-product map already fetched (`liveById`) to read each line's category; if categories aren't on the product object, pass `categoryId: null` (only matters when `APPLY_TO_IMPORTED` is false).
  - When `opts?.quote`:
    - **Server re-validate**: `if (!qualifiesForBulk(subtotal)) return { ok:false, error:'Bulk quote requires a $2,500+ subtotal.' }`.
    - **Skip** the payment-proof requirement (do not require `proofPath`).
    - `const discountCents = bulkDiscountCents(bulkLines);`
    - `const shipping = 0;` (team sets it later)
    - `const total = subtotal - discountCents;`
    - Insert with `status: 'quote_pending'`, `shipping_cents: 0`, `total_cents: total`, `discount_code: BULK_MARKER`, and all the same customer/shipping/address fields as the normal path. Do **not** require/insert a payment proof.
    - After insert, send the quote emails (Task 9) instead of `sendOrderEmails`.
  - When not quote: behaviour is exactly as today (normal `order_received`, proof required, `promoDiscountCents`, `sendOrderEmails`).

```ts
// sketch of the branch inside createOrder, after validation + subtotal:
const bulkLines = input.items.map(l => ({
  unitCents: l.unit_cents,
  quantity: l.quantity,
  categoryId: (liveById.get(l.product_id) as { category?: string } | undefined)?.category ?? null,
}));

if (opts?.quote) {
  if (!qualifiesForBulk(subtotal)) {
    return { ok: false, error: 'A bulk quote requires a $2,500 or higher product subtotal.' };
  }
  const discountCents = bulkDiscountCents(bulkLines);
  const total = subtotal - discountCents;
  const { data: order, error: orderError } = await admin.from('orders').insert({
    user_id: user.id,
    status: 'quote_pending',
    subtotal_cents: subtotal,
    shipping_cents: 0,
    total_cents: total,
    currency: 'USD',
    shipping_address: { street: s.street, city: s.city, state_province: s.stateProvince, postal_code: s.postalCode, country: s.country },
    customer_name: s.fullName,
    customer_email: s.email,
    customer_phone: s.phone,
    fedex_account: isValidFedexAccount(s.fedexAccount) ? s.fedexAccount.trim() : null,
    payment_method: 'wise',
    notes,
    discount_code: BULK_MARKER,
  }).select('id, order_number, order_seq, view_token').single();
  if (orderError || !order) return { ok: false, error: orderError?.message ?? 'Could not create the quote.' };
  // insert order_items (same loop as the normal path)
  // … then:
  await sendQuoteEmails({ /* order + customer + subtotal + discountCents */ });
  return { ok: true, orderNumber: order.order_number, viewToken: order.view_token };
}
```

> Match the exact insert column set + `order_items` loop + `CreateOrderResult` shape used by the normal path (read lines 213-310 and mirror them). Reuse `isValidFedexAccount` (already imported via `computeShippingCents`'s module — import it if not).

- [ ] **Step 2: Add the public action.**

```ts
export async function requestBulkQuoteAction(payload: string): Promise<CreateOrderResult> {
  const input = JSON.parse(payload) as CreateOrderInput; // same shape placeOrderAction parses
  return createOrder(input, { quote: true });
}
```

> Mirror how `placeOrderAction` (lines 376-397) parses its payload/FormData; keep the contract identical so the client can reuse the same payload builder.

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` → no errors. (`sendQuoteEmails` lands in Task 9 — temporarily stub it as `async () => {}` to keep this task compiling, or sequence Task 9 first. Prefer doing Task 9 before this step's email call — see ordering note.)
- [ ] **Step 4: Commit.**

```bash
git add app/[locale]/checkout/actions.ts
git commit -m "feat(checkout): requestBulkQuoteAction creates a quote_pending order (no payment)"
```

### Task 9: Quote + payment-open emails

**Files:**
- Modify: `lib/email/sendOrderEmails.ts`, `lib/email/templates.ts`

**Interfaces:**
- Produces: `sendQuoteEmails(order)` (team notification + customer ack), `sendPaymentOpenEmail(order)` (customer, when payment opened).
- Consumes: existing `mailer`, `ADMIN_NOTIFICATION_EMAIL`, template helpers.

- [ ] **Step 1: Templates.** In `lib/email/templates.ts`, add `quoteTeamEmail(order)`, `quoteAckEmail(order)`, `paymentOpenEmail(order)` (HTML + text), mirroring `receiptEmail`/`customerEmail` structure:
  - **Team**: subject `New quote request — ${order.orderNumber}`; body: customer name, full shipping address, product subtotal, 15% discount, product-after-discount, "Shipping: to be quoted".
  - **Customer ack**: subject `We received your quote request — ${order.orderNumber}`; body: "Thank you — we'll email your full total (15% off + actual shipping) within 1–3 business days. No payment is needed yet."
  - **Payment open**: subject `Your order total is ready — ${order.orderNumber}`; body: final total, link to the in-app order page (`/account/orders/<order_seq>`), short "pay via Wise as usual" note (it can reuse the Wise details block, also sourced from `WISE_PAYMENT`).

- [ ] **Step 2: Senders.** In `lib/email/sendOrderEmails.ts`:

```ts
export async function sendQuoteEmails(order: QuoteEmailData) {
  // team → ADMIN_NOTIFICATION_EMAIL, never throws (match sendOrderEmails)
  // customer ack → order.customerEmail
}
export async function sendPaymentOpenEmail(order: QuoteEmailData) {
  // customer → order.customerEmail
}
```

Define `QuoteEmailData` (orderNumber, orderSeq, customerName, customerEmail, shippingAddress, subtotalCents, discountCents, totalCents). Reuse the transport + `try/catch → {ok}/{error}` pattern from `sendOrderEmails`.

- [ ] **Step 3: Wire** `sendQuoteEmails` into `createOrder`'s quote branch (Task 8 Step 1).
- [ ] **Step 4: Typecheck + build.** `npx tsc --noEmit` && `npx next build` → succeed.
- [ ] **Step 5: Commit.**

```bash
git add lib/email/templates.ts lib/email/sendOrderEmails.ts app/[locale]/checkout/actions.ts
git commit -m "feat(email): quote-request (team+customer) and payment-open emails"
```

---

## Phase 5 — Payment-step bulk gate UI

### Task 10: `BulkDiscountGate` + wire into PaymentStep

**Files:**
- Create: `components/checkout/BulkDiscountGate.tsx`
- Modify: `components/checkout/PaymentStep.tsx`
- Modify: `messages/en.json`, `messages/ru.json` (`checkout.bulk.*`)

**Interfaces:**
- Consumes: `BULK_THRESHOLD_CENTS` from `@/lib/checkout/bulk`; `requestBulkQuoteAction` from checkout actions; a `formatUSD` helper.
- Produces: `BulkDiscountGate` with props `{ subtotalCents: number; shippingCents: number; discountCents: number; payload: string; onChoosePayNow: () => void; locale: string }`.

- [ ] **Step 1: i18n keys.** Add `checkout.bulk` to en.json (+ ru.json) — popup title/body/next, card A (title, "no discount", "shipping {amount}", "total due now {amount}", cta), card B (title, "15% off everything", "shipping quoted in 1–3 business days", "due now {amount}", cta "Request my full quote"), and `quoteRequested` (confirmation title/body). Use ICU `{amount}` placeholders.

- [ ] **Step 2: Component.** Build a client component with internal `step` state (`'popup' | 'options' | 'requesting' | 'done'`). Card A's shipping shows the **passed-in real `shippingCents`** with the note "$35 — US without a FedEx account: $65". Card B shows `subtotalCents - discountCents` and calls the server action:

```tsx
'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { requestBulkQuoteAction } from '@/app/[locale]/checkout/actions';

interface Props {
  subtotalCents: number; shippingCents: number; discountCents: number;
  payload: string; onChoosePayNow: () => void; locale: string;
}
const usd = (c: number, l: string) => (c / 100).toLocaleString(l, { style: 'currency', currency: 'USD' });

export default function BulkDiscountGate({ subtotalCents, shippingCents, discountCents, payload, onChoosePayNow, locale }: Props) {
  const t = useTranslations('checkout.bulk');
  const [step, setStep] = useState<'popup' | 'options' | 'requesting' | 'done'>('popup');
  const [error, setError] = useState('');

  async function requestQuote() {
    setStep('requesting'); setError('');
    const res = await requestBulkQuoteAction(payload);
    if (!res.ok) { setError(res.error); setStep('options'); return; }
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="bg-white border border-gold/40 rounded-lg p-6 text-center">
        <h2 className="font-display italic text-xl text-charcoal mb-2">{t('quoteRequested.title')}</h2>
        <p className="text-sm text-mist">{t('quoteRequested.body')}</p>
      </div>
    );
  }
  // 'popup' → celebratory modal with Next → setStep('options')
  // 'options' → two cards: A calls onChoosePayNow() (reveals normal payment UI);
  //             B calls requestQuote(); show `error` if set; disable while 'requesting'.
  // Render with existing Tailwind tokens. (Full JSX mirrors lumee3/BulkOrderFlow.jsx,
  // restyled; Option A "total due now" = usd(subtotalCents + shippingCents, locale).)
  return /* … popup/options markup … */ null;
}
```

> Fill the `popup`/`options` JSX following `lumee3/BulkOrderFlow.jsx` (re-themed). Option A note text comes from an i18n key; Option A total uses the **real** `shippingCents` prop.

- [ ] **Step 3: Wire into PaymentStep.** In `components/checkout/PaymentStep.tsx`, after totals are computed (`subtotalCents`, `shippingCents` via `computeShippingCents`, the existing `payload`), gate the normal payment UI:
  - Add state `const [bulkChoice, setBulkChoice] = useState<'none' | 'paynow'>('none')`.
  - If `subtotalCents >= BULK_THRESHOLD_CENTS && bulkChoice === 'none'`: render `<BulkDiscountGate subtotalCents={subtotalCents} shippingCents={shippingCents} discountCents={bulkDiscountCents(bulkLinesFromItems)} payload={payload} locale={locale} onChoosePayNow={() => setBulkChoice('paynow')} />` **instead of** the Wise/USDT/proof/confirm UI.
  - Otherwise render the existing payment UI unchanged (Option A = pay now).
  - Build `bulkLinesFromItems` from `items` using `categoryIdForProduct` if available, else `categoryId: null`.

- [ ] **Step 4: Typecheck + build.** `npx tsc --noEmit` && `npx next build` → succeed.
- [ ] **Step 5: Manual check.** Cart ≥ $2,500 → payment step shows popup → Next → two cards. A shows real shipping (US-no-FedEx = $65) and reveals normal payment. B → "quote requested", a `quote_pending` order exists, team + customer emails fired. Cart < $2,500 → no gate, normal payment.
- [ ] **Step 6: Commit.**

```bash
git add components/checkout/BulkDiscountGate.tsx components/checkout/PaymentStep.tsx messages/en.json messages/ru.json
git commit -m "feat(checkout): $2,500+ bulk gate — pay-now vs 15%-off quote"
```

---

## Phase 6 — Admin quote handling

### Task 11: Set shipping + "Open payment"

**Files:**
- Create: `components/admin/QuoteShippingPanel.tsx`
- Modify: `app/manzura/orders/actions.ts` (new `openOrderPayment` action; transition guard)
- Modify: `app/manzura/orders/[id]/page.tsx` (render the panel when `quote_pending`)

**Interfaces:**
- Produces: `openOrderPayment(orderId: number, shippingCents: number): Promise<ActionResult>`.
- Consumes: existing `requireAdmin`, `createServiceClient`, `sendPaymentOpenEmail`.

- [ ] **Step 1: Server action.**

```ts
// app/manzura/orders/actions.ts
export async function openOrderPayment(orderId: number, shippingCents: number): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }
  if (!Number.isFinite(shippingCents) || shippingCents < 0) return { ok: false, error: 'Invalid shipping amount' };
  const supabase = createServiceClient();
  const { data: o } = await supabase.from('orders').select('id, status, subtotal_cents, total_cents, discount_code').eq('id', orderId).single();
  if (!o || o.status !== 'quote_pending') return { ok: false, error: 'Order is not awaiting a quote.' };
  // total = subtotal − discount + shipping; discount = subtotal + 0 − total (current total has shipping 0)
  const discount = (o.subtotal_cents as number) - (o.total_cents as number);
  const newTotal = (o.subtotal_cents as number) - discount + Math.round(shippingCents);
  const { error } = await supabase.from('orders')
    .update({ shipping_cents: Math.round(shippingCents), total_cents: newTotal, status: 'awaiting_payment' })
    .eq('id', orderId);
  if (error) return { ok: false, error: error.message };
  await sendPaymentOpenEmail(/* load fields for the email */);
  revalidatePath(`/manzura/orders/${orderId}`);
  return { ok: true };
}
```

- [ ] **Step 2: Transition guard.** In `updateOrderStatus`, forbid jumping straight from `quote_pending` to anything except `awaiting_payment` or `cancelled` (so the generic flip can't skip the open-payment step):

```ts
if (current.status === 'quote_pending' && !['awaiting_payment', 'cancelled'].includes(nextStatus)) {
  return { ok: false, error: 'Set shipping and Open payment first.' };
}
```

(Place after the row snapshot is loaded; `current` is the existing snapshot variable.)

- [ ] **Step 3: Panel component.** `QuoteShippingPanel` (client): a cents input for shipping + a live "new total = subtotal − discount + shipping" preview + an **"Open payment"** button calling `openOrderPayment(orderId, shippingCents)`; on success the page revalidates and the order becomes `awaiting_payment`.

- [ ] **Step 4: Render it.** In `app/manzura/orders/[id]/page.tsx`, when `order.status === 'quote_pending'`, render `<QuoteShippingPanel orderId={order.id} subtotalCents={order.subtotal_cents} discountCents={order.subtotal_cents - order.total_cents} />` in the admin section.

- [ ] **Step 5: Typecheck + build.** `npx tsc --noEmit` && `npx next build` → succeed.
- [ ] **Step 6: Manual check.** Open a `quote_pending` order → enter shipping → preview total → "Open payment" → status becomes `awaiting_payment`, customer payment-open email fires. The generic status panel cannot move `quote_pending` directly to `payment_verified`.
- [ ] **Step 7: Commit.**

```bash
git add components/admin/QuoteShippingPanel.tsx app/manzura/orders/actions.ts "app/manzura/orders/[id]/page.tsx"
git commit -m "feat(admin/orders): set shipping + Open payment for quote orders"
```

---

## Phase 7 — Customer in-app payment for `awaiting_payment`

### Task 12: `OrderPaymentSection` + attach-proof action

**Files:**
- Create: `components/account/OrderPaymentSection.tsx`
- Modify: `app/[locale]/account/orders/[seq]/page.tsx`
- Modify: `app/[locale]/checkout/actions.ts` (new `attachOrderPaymentProof`)

**Interfaces:**
- Produces: `attachOrderPaymentProof(orderId: number, proofPath: string, transactionLink?: string): Promise<{ ok: boolean; error?: string }>`.
- Consumes: `WisePaymentInfo`, the existing proof-upload server action (`uploadPaymentProof`).

- [ ] **Step 1: Server action.** In checkout actions, add an authenticated action that verifies the order belongs to the caller and is `awaiting_payment`, then writes `payment_proof_path`/`payment_transaction_link` (does NOT change status — the team verifies):

```ts
export async function attachOrderPaymentProof(orderId: number, proofPath: string, transactionLink?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  const { data: o } = await supabase.from('orders').select('id, status').eq('id', orderId).eq('user_id', user.id).maybeSingle();
  if (!o || o.status !== 'awaiting_payment') return { ok: false, error: 'This order is not awaiting payment.' };
  const admin = createServiceClient();
  const { error } = await admin.from('orders').update({
    payment_proof_path: (proofPath ?? '').trim(),
    payment_transaction_link: (transactionLink ?? '').trim().slice(0, 500),
  }).eq('id', orderId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
```

- [ ] **Step 2: Component.** `OrderPaymentSection` (client) renders the final total, `<WisePaymentInfo />`, and a proof upload (reuse `uploadPaymentProof` then `attachOrderPaymentProof`) — the same proof UX as `PaymentStep`, driven by the existing order id.

- [ ] **Step 3: Render it.** In the customer order page, when `order.status === 'awaiting_payment'`, render `<OrderPaymentSection orderId={order.id} totalCents={order.total_cents} currency={order.currency} />` near the top (above Items). For other statuses, render nothing new.

- [ ] **Step 4: Typecheck + build.** `npx tsc --noEmit` && `npx next build` → succeed.
- [ ] **Step 5: Manual check.** As the customer, open an `awaiting_payment` order → see the final total + Wise details + proof upload → upload a screenshot → admin sees the proof and can mark `payment_verified` → order continues through the normal pipeline.
- [ ] **Step 6: Commit.**

```bash
git add components/account/OrderPaymentSection.tsx "app/[locale]/account/orders/[seq]/page.tsx" app/[locale]/checkout/actions.ts
git commit -m "feat(account): in-app payment for awaiting_payment (quoted) orders"
```

---

## Phase 8 — End-to-end verification

### Task 13: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Static.** `npx tsx scripts/verify-bulk.ts` (pass) → `npx tsc --noEmit` (no errors) → `npx next build` (success).
- [ ] **Step 2: Bulk gate.** Cart ≥ $2,500 → popup → Next → two cards. Option A shows the customer's **real** shipping ($65 for US-without-FedEx) and proceeds to normal payment. Cart < $2,500 → no gate.
- [ ] **Step 3: Option B.** Choose B → `quote_pending` order created (no payment), **team notification + customer ack** emails fire, customer sees "quote requested".
- [ ] **Step 4: Quote → pay.** Admin sets shipping → "Open payment" → `awaiting_payment` + customer payment-open email. Customer pays in-app (Wise + proof). Admin verifies → `payment_verified` → packaging → shipped → delivered. Confirm `quote_pending → payment_verified` direct jump is blocked.
- [ ] **Step 5: Security.** Ineligible cart (subtotal < $2,500) + `BULK15` / `bulk15` in the promo box → rejected, no discount. The 15% is reachable only via the bulk gate.
- [ ] **Step 6: Single source.** Site Wise section and a freshly-sent order email show the **identical** Korestetics Global account. Edit one value in `lib/checkout/wisePayment.ts` → both reflect it after rebuild; revert.
- [ ] **Step 7: Receipt.** Admin receipt copy header shows only `SGL #00xxxx`.
- [ ] **Step 8: Commit any doc/cleanup; deploy.** Push to `main` (auto-deploys). Run migration `030` in Supabase if not already. Remove dead `WISE_*` env vars in Vercel.

---

## Notes / sequencing

- **Phases 1–2 are independent** and can ship first (receipt, Wise single-source, bulk logic, BULK15 guard) — each is a safe, self-contained deploy.
- **Do Task 9 (emails) before wiring Task 8's email call**, or stub `sendQuoteEmails` to keep Task 8 compiling.
- Migration `030` must be applied in Supabase **before** Option B orders are created in production.
- The two new statuses widen `OrderStatus`; expect `tsc` to flag exhaustive maps/switches (customer `OrderStepper`, `OrderStatusBadge`, admin badges) — handle the new values (quote statuses render their own badge; they are not part of the 5-stage stepper).
