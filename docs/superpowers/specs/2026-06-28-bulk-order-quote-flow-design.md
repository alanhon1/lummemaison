# Bulk-Order Quote Flow + Wise Payment Single-Source + Receipt Header — Design

**Date:** 2026-06-28
**Sub-project:** lumee3 ① of 4 (sequence: ① this → ④ FAQ → ③ PWA+push → ② FR/ES)
**Source brief:** `lumee3/claude-code-task.md` (+ reference UIs `BulkOrderFlow.jsx`, `PaymentInfoSection.jsx`, `wise-1..4.jpeg`)
**Stack:** Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase · next-intl (en/ru today) · Nodemailer · Vercel

---

## 1. Overview

`lumee3` is a batch of four independent sub-projects. This spec covers **sub-project ①** only:

- **A. Bulk-order discount flow** — at cart subtotal ≥ $2,500, offer the customer two paths at the payment step: pay now (no discount, normal shipping) or 15% off everything via a team-quoted order.
- **B. Wise payment single-source + receipt header** — replace the on-site Wise payment section with the new Korestetics Global content (4 screenshots, 6 steps, copy-pastable bank details), make a single config constant the **single source of truth** shared by the site and the order email, and drop the `No:` label from the copy-pastable receipt header.

**MAISON15** (brief Task 2) is already fully removed (code + DB) as of 2026-06-28, so the bulk flow is a fresh, independent implementation.

The other three sub-projects (FR/ES locales, PWA+push, FAQ page) are **out of scope** here and get their own spec → plan → implementation cycles.

## 2. Goals / Non-goals

**Goals**
- Customers with a ≥ $2,500 subtotal are offered the bulk choice at the payment step.
- Option A = continue normal checkout (no discount, existing $35/$65 shipping rules, **real** shipping shown).
- Option B = 15% off everything (incl. imported), pay $0 now, order created as `quote_pending`, team notified by email; customer pays later, in-app, once the team opens payment.
- Wise bank details live in exactly one place, shared by the site and the order email.
- Receipt header shows only the order number.

**Non-goals**
- No automatic discounts on product create / sale.
- No change to the USDT payment section or any other checkout/payment logic beyond the above.
- No runtime translation; fr/es deferred to sub-project ②.
- No automated quoting — the team sets shipping and opens payment manually.

## 3. Confirmed decisions (from brainstorming)

| # | Decision |
|---|---|
| D1 | Threshold **$2,500** subtotal; discount **15%**. |
| D2 | `APPLY_TO_IMPORTED = true` (15% applies to imported too). Keep as a flippable switch, default `true`. |
| D3 | Popup + two-option cards appear at the **payment step** (address + disclaimers already collected; totals known). |
| D4 | **Option A** reuses the **existing shipping logic** (NOT hardcoded $35). The card/popup must display the customer's **actual** shipping — US-without-valid-FedEx shows **$65** — with a clarifying note. |
| D5 | **Option B** customer fills the normal shipping form first; only the payment step is replaced by "request quote". |
| D6 | Two new statuses with a **payment lock**: `quote_pending → awaiting_payment → payment_verified`. No auto-jump from `quote_pending` to `payment_verified`. The team presses **"Open payment"** to move `quote_pending → awaiting_payment`. |
| D7 | In `awaiting_payment`, the customer pays via an **in-app per-order payment page** (reuses the existing Wise + proof-upload UI). |
| D8 | The order **instruction email** uses the **same** Korestetics Global account as the site. Bank details live in **one** config constant (`lib/checkout/wisePayment.ts`); the email imports it too. **Remove the scattered env-based Wise bank values.** |
| D9 | Option B **customer acknowledgement email is required** (confirmed). |
| D10 | `BULK15` is a **server-only reserved marker** — explicitly rejected by the promo redemption/validation path so it can never be redeemed via the promo box (security). |

---

## 4. Section A — Bulk-order discount flow

### A1. Config / pure logic — `lib/checkout/bulk.ts` (new)
Pure, framework-agnostic, unit-testable (no Supabase, no I/O):

```ts
export const BULK_THRESHOLD_CENTS = 250_000; // $2,500
export const BULK_RATE = 0.15;
export const APPLY_TO_IMPORTED = true; // flip to false later to exclude imports

// 15% off; when APPLY_TO_IMPORTED is false, imported subtotal is excluded
// from the discount base (but still counts toward the threshold).
export function bulkDiscountCents(lines: PromoLine[], applyToImported = APPLY_TO_IMPORTED): number
export function qualifiesForBulk(subtotalCents: number): boolean // subtotal >= threshold
```

`PromoLine` mirrors the existing checkout line shape (`unitCents`, `quantity`, `categoryId`). Imported = the catalogue's imported-products category id (same identifier the removed MAISON15 work referenced).

### A2. Payment-step trigger + popup + two cards — `components/checkout/PaymentStep.tsx`
- On mount / when `subtotalCents >= BULK_THRESHOLD_CENTS` **and** the customer has not yet chosen → show a **celebratory popup** ("You've hit the bulk discount!") with a **Next** button (mirrors `BulkOrderFlow.jsx`).
- **Next → two cards:**
  - **Option A — Pay now:** no discount; shipping = `computeShippingCents(draft.shipping)` (the **real** value — $35, or $65 for US-without-valid-FedEx); "Total due now" = `subtotal + realShipping`. Note line: *"$35 — US without a FedEx account: $65."* Proceeds via the existing `placeOrderAction` (unchanged normal checkout).
  - **Option B — 15% off:** shows product-after-15%, "Shipping — quoted in 1–3 business days", **Due now $0**. Button **"Request my full quote"** → calls `requestBulkQuoteAction` (A3).
- Choice is held in component state. Picking A reveals the normal payment UI; picking B replaces it with the quote-request confirmation.
- Style with existing Tailwind tokens (charcoal/gold/cream), not the reference's stone/amber palette. Mobile-first.

### A3. Option B server action — `app/[locale]/checkout/actions.ts`
New `requestBulkQuoteAction` (a `createOrder` variant):
- Inserts an order with `status='quote_pending'`, `discount_code='BULK15'`, `subtotal_cents = subtotal`, discount = `bulkDiscountCents(...)`, `shipping_cents = 0` (TBD by team), `total_cents = subtotal − discount` (shipping added later). Reuses existing validation (auth, cart availability, disclaimers, shipping completeness) **except** the payment-proof requirement, which is skipped for quote orders.
- Discount is represented the same way promos are today (`total = subtotal − discount + shipping`); **no new `discount_cents` column** (YAGNI — rejected alternative below).
- Fires a **team notification email** (A6). Returns the order number for the confirmation screen.
- No payment captured. Customer lands on a **"Quote requested"** confirmation ("Our team will email your full total within 1–3 business days. No payment is needed yet.").

### A4. Status model — two new statuses
Pipeline (Option B branch):
```
quote_pending → awaiting_payment → payment_verified → packaging → shipped → delivered
                                                        (+ cancelled from any stage)
```
- `quote_pending`: created, no payment, **customer sees no payment step**. Team notified.
- `awaiting_payment`: team has set the real shipping/total and **opened payment**; customer can now pay in-app (A7).
- **No auto-jump** `quote_pending → payment_verified`.

**Touch points to add both statuses:**
- `lib/orders/status.ts` — extend `OrderStatus`; decide stage ordering (these two are pre-`payment_verified`).
- New migration `030_quote_statuses.sql` — extend the `status` CHECK constraint (migration 006) to allow `quote_pending`, `awaiting_payment`.
- `app/manzura/orders/actions.ts` — add to `VALID_STATUSES`; add the transition rules below.
- `app/manzura/orders/page.tsx` — `statusBadge()` entries + filter chips for both.

### A5. Admin order detail (quote orders) — `app/manzura/orders/[id]/` + status panel
When `status='quote_pending'`:
- **"Set shipping & total"** mini-form: admin enters real `shipping_cents` → `total_cents` recomputed = `subtotal − discount + shipping`.
- **"Open payment"** button → `updateOrderStatus(id, 'awaiting_payment')` (requires a shipping value set first) → notifies the customer (A6).
- Quote orders are exempt from the proof-required gate.

When `status='awaiting_payment'`: normal admin actions; team marks `payment_verified` after verifying the customer's uploaded proof (existing flow).

### A6. Emails — `lib/email/*`
- **`sendQuoteRequestEmail(order)`** → `ADMIN_NOTIFICATION_EMAIL`: "New quote request — SGL #…", customer name, full shipping address, product subtotal, 15% discount, product-after-discount; "shipping TBD".
- **Customer acknowledgement (CONFIRMED — required)** on Option B submit: a short email — *"Quote request received — we'll email your full total within 1–3 business days. No payment is needed now."* Rationale: a $0 "request" leaves nothing in the customer's hands once they close the screen; the ack reduces follow-up enquiries.
- **Customer payment-open email** when `quote_pending → awaiting_payment`: final total + link to pay in-app. Reuses the instruction-email template (now sourced from `wisePayment.ts`, see Section B).
- Reuse `lib/email/mailer.ts` + `templates.ts` patterns; emails never throw (match `sendOrderEmails` behaviour).

### A7. Customer in-app payment page (`awaiting_payment`)
- Surface on the customer's order detail (`app/[locale]/account/orders/[seq]/page.tsx`; the order-number/`view_token` confirmation route may also link here). When `status='awaiting_payment'`, render a payment section that **reuses the Wise instructions + payment-proof upload** from `PaymentStep` (extract the shared pieces), driven by the **existing order** (team-set total), not the checkout draft.
- A server action attaches the uploaded proof to the order (`payment_proof_path` / `payment_transaction_link`). Team then verifies → `payment_verified`.

### A9. Security — `BULK15` is a server-only reserved marker (REQUIRED)
`BULK15` is **not a redeemable promo code**. It is set **only** server-side inside `requestBulkQuoteAction` to label bulk-quote orders. The customer must never be able to obtain the 15% by typing it.

- The promo redemption/validation path — `promoDiscountCents()` and `validatePromoCode()` in `app/[locale]/checkout/actions.ts` — **explicitly rejects** the reserved marker: normalize the entered code (trim + uppercase, as promos already do) and if it equals `BULK15` (or any future reserved bulk marker), return "not a valid code" **before** any DB lookup — so even a mistakenly-created `BULK15` promo row can never apply.
- Keep the reserved set in one place (e.g. `RESERVED_PROMO_CODES = new Set(['BULK15'])`) referenced by both the redeem path and any admin promo-create validation (optional: block creating a code with a reserved name).
- The 15% bulk discount is therefore reachable **only** through the ≥ $2,500 payment-step flow, never the promo box.

### A8. i18n
Add keys to `messages/en.json` + `messages/ru.json` for: popup title/body/Next, Option A card, Option B card, "Request my full quote", quote-requested confirmation, and the new email/status strings. (fr/es handled in sub-project ②, with English fallback meanwhile.)

### Rejected alternative (data model)
Add explicit `discount_cents` + `order_type` columns for cleaner per-order data. Cleaner long-term but more migration + code churn; not needed now — discount is already inferable from `subtotal + shipping − total`, consistent with the current promo system.

---

## 5. Section B — Wise payment single-source + receipt header

### B1. Receipt header — `components/admin/OrderReceiptModal.tsx`
In `buildPackagingText`, change the header line from `No:   ${props.orderNumber}` to **`${props.orderNumber}`** (e.g. `SGL #005167`). Applies to the copy-pastable text and the Excel export, all future orders.

### B2. Wise bank details — single source of truth — `lib/checkout/wisePayment.ts` (new)
- Export the Korestetics Global bank fields as **one** constant — the **only** place these values live:
  `SWIFT IBKOKRSE` · `Industrial Bank of Korea` · account `67704136004017` · receiver `KORESTETICS GLOBAL` · `Songdogwahak-ro-80` · `Yeonsu-gu` · `Incheon` · `Republic of Korea` · `21984` · `+82-10-2942-7225` · `sg@koresteticsglobal.com`.
- Plain data module (no `'use client'`/`'use server'`), importable by both client and server.
- **Consumers:**
  - On-site Wise section (B3) imports it.
  - Order **instruction email** (`lib/email/templates.ts`) imports it.
- **Remove** the scattered **env-based Wise bank values** currently feeding the payment page and the email. One file edit now updates both surfaces.

> Money-critical: a single source prevents the site and the email from showing different account numbers.

### B3. On-site Wise section — replace the Wise block in `components/checkout/PaymentStep.tsx`
- **6-step send instructions** + a "select *Pay for goods and services*" callout (text → i18n).
- **4 screenshots:** move `lumee3/wise-1..4.jpeg` → `public/images/wise/wise-1..4.jpeg`; render via `next/image` (replaces the single `wise-example.jpg`).
- **Copy-pastable bank details** from `wisePayment.ts`: "Copy all" + per-field copy (reuse existing `CopyButton` component).
- Bank field **values are literal** (never translated); only the prose steps are i18n.
- **USDT section unchanged.** Match existing Tailwind tokens (not the reference's stone/amber).

---

## 6. Data / migration summary

- **`030_quote_statuses.sql`** — extend the orders `status` CHECK to allow `quote_pending`, `awaiting_payment`. (Run manually in Supabase per the project's migration workflow.)
- No other schema changes (discount stays inferred; Wise details are app config, not DB).

## 7. Files to touch (map)

**New**
- `lib/checkout/bulk.ts` · `lib/checkout/wisePayment.ts`
- `supabase/migrations/030_quote_statuses.sql`
- (likely) a small shared Wise-payment + proof component extracted from `PaymentStep` for reuse in the customer order page.

**Edit**
- `components/checkout/PaymentStep.tsx` (popup, two cards, Wise block, real shipping display)
- `app/[locale]/checkout/actions.ts` (`requestBulkQuoteAction`)
- `lib/orders/status.ts` · `app/manzura/orders/actions.ts` · `app/manzura/orders/page.tsx` · `app/manzura/orders/[id]/…` (status panel: set shipping/total + Open payment)
- `app/[locale]/account/orders/[seq]/page.tsx` (in-app pay for `awaiting_payment`)
- `lib/email/templates.ts` · `lib/email/sendOrderEmails.ts` (quote + payment-open emails; Wise from constant)
- `components/admin/OrderReceiptModal.tsx` (header)
- `messages/en.json` · `messages/ru.json`

**Assets**
- `public/images/wise/wise-1..4.jpeg`

## 8. Verification

- `tsc --noEmit` ✅, `next build` ✅.
- Cart ≥ $2,500 → payment step shows popup → Next → two cards.
- Option A: card shows **real** shipping; US-without-FedEx shows $65; normal order places unchanged.
- Option B: creates `quote_pending` order (no payment), **team notification email + customer acknowledgement email** both fire, customer sees "quote requested".
- **Security:** with an **ineligible cart (subtotal < $2,500)**, typing `BULK15` (and case/whitespace variants) into the promo box is **rejected** as invalid — no discount applied. Confirm the 15% is unreachable except via the ≥ $2,500 payment-step flow.
- Admin: set shipping/total on the quote order → "Open payment" → `awaiting_payment`; customer pays in-app (Wise + proof); team verifies → `payment_verified` → normal pipeline. No `quote_pending → payment_verified` jump available.
- Site Wise section and order email show the **identical** Korestetics Global account (single source). Editing `wisePayment.ts` updates both.
- Receipt header shows only `SGL #…` (no `No:`).
- Mobile-first throughout.

## 9. Open items

- Exact stage ordering/labels for the two new statuses in the admin badge map (cosmetic).
