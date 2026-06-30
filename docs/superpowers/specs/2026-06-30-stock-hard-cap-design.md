# Stock Hard-Cap — Design

Date: 2026-06-30

## Problem

Customers can order **more than the available stock**. Example: 4 units in stock,
a customer orders 7 → the order goes through, and at fulfilment the stock shows a
shortage ("재고 부족 -3"). To shoppers this is a contradiction: an item shows stock
0 (or sold out) yet is still orderable.

This is the **deliberate reverse** of the 2026-06-14 oversell design
(`2026-06-30` supersedes `2026-06-14-oversell-and-restock-guard-design.md`). The
business has decided oversell should no longer be allowed on the storefront.

## Goal

1. **Hard-cap order quantity at available stock**, everywhere a quantity can be
   raised (product page, cart drawer, cart page) and authoritatively at order time.
2. **Stock 0 / unknown → not orderable.** Only a "request" path remains.
3. **No contradiction:** a shopper can never check out a quantity that exceeds the
   item's available stock.

## Non-goals

- **Concurrency / stock reservation is out of scope.** Stock is still decremented at
  the admin `packaging` step, not at checkout. Two customers can each pass the order
  guard for the same 4 units; the second is caught by the existing DB floor
  (`decrement_stock_for_order`, migration 034) at packaging. Single-customer
  oversell — the reported problem — is fully prevented. Per-order reservation is a
  larger future change.
- No DB schema/migration change.
- No new "request" subsystem — reuse the existing "Make a request" flow.

## Definitions

**`availableStock(product, option)`** — the per-(product, option) cap used everywhere:

- `notForSale` → **not orderable** (existing hard block, unchanged).
- `stock_unknown` **or** `wonder` flag set → cap = **0** (not orderable; request only).
- otherwise → cap = the manual `stock` integer for that `(product_id, option)`.
  Stock `0` → not orderable (request only).

"Not orderable" means: no add-to-cart, no quantity raise; the UI shows the existing
"Make a request" affordance instead.

MOQ is display-only (label) and is **not** enforced as a minimum, so it cannot
deadlock against the cap.

## Design

### 1. Per-option stock in the cart (foundation)

Today the cart's stock hooks (`lib/useCartStock.ts`, `/api/products/stock`,
`/api/products/availability`) operate on **per-product totals** (`getStockMap` sums
across options). Cart lines carry `option`, so cart-side stock must become
**per-option** to produce an accurate cap.

- Extend the cart stock source to return per-`(product_id, option)` availability
  (reuse `getStockFlagsMap` / `getProductOptionStock` in `lib/products/stock.ts`,
  which already key by `stockKey(productId, option)`).
- `useCartStock` exposes, per cart line: `cap = availableStock(...)` and the raw
  stock number, instead of only an `isBackorder` boolean.

### 2. Storefront enforcement

- **`components/catalogue/ProductDetailClient.tsx`** — `handleAddToCart` is blocked
  when the selected option's `availableStock <= currentCartQtyForThatLine`. When the
  selected option is not orderable (stock 0 / unknown / wonder), keep showing the
  existing "Make a request" button (already wired for `outOfStock`).
- **`components/layout/CartPanel.tsx`** (lines ~110-122) and
  **`components/checkout/CartPageClient.tsx`** (lines ~64-78) — the `+` button is
  disabled when `item.quantity >= cap`. When at the cap, show a message:
  **"재고 N개 남음 · 마지막입니다 · 더 필요하면 request"** with a button linking to the
  existing Make-a-request flow. (`N` = cap.)
- **`lib/store.ts`** — the store stays "dumb" (no stock lookups). Enforcement lives
  in the UI (which has the stock hook) and authoritatively on the server. The store's
  `updateQuantity` still floors at 0.

### 3. Existing oversold carts (rollout safety)

Customers may already hold `localStorage` (`lumiere-cart`) lines with
`quantity > cap`. When cart stock loads:

- Clamp each over-cap line down to its `cap` (a line whose cap is 0 is removed).
- Show a one-time notice: **"재고 변동으로 일부 수량이 조정됐습니다."**

### 4. Authoritative server guard

**`app/[locale]/checkout/actions.ts` `createOrder`** (per-line check, ~200-222):

- Replace the current `optStock <= 0` block with: reject the line when
  `l.quantity > availableStock(product, option)` — where availableStock applies the
  unknown/wonder/notForSale rules above (unknown/wonder/0 ⇒ cap 0 ⇒ any quantity
  rejected).
- Remove the "oversell is allowed by design" stance (lines ~245-249).
- On rejection, return a clear per-line error the checkout UI surfaces (which items,
  how many are available) so the customer can adjust before paying.

### 5. Admin side (unchanged, kept as safety net)

- The packaging-time deduction guard and DB floor (migration 034) stay as the
  last line of defense for the deferred concurrency case.
- `autoAddStock` (admin top-up workaround) stays available but should rarely be
  needed now.

## Verification

Push to `main` → auto-deploy → verify on the live site:

1. Product with stock 4: cart `+` stops at 4; message + request shown at the cap.
2. Stock 0 / `stock_unknown` / `wonder` item: not orderable; only "Make a request".
3. Per-option: a sold-out option blocks while an in-stock option of the same product
   still caps correctly at its own number.
4. Attempt to check out an over-cap quantity (e.g. via stale cart): `createOrder`
   rejects with a clear message; no order is created.
5. Existing localStorage cart with an over-cap line: clamped down on load with the
   adjustment notice.
6. `notForSale` item: still cannot add (unchanged).
