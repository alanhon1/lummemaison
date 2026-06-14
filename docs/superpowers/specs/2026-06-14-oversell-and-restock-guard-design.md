# Oversell + Admin Restock Guard — Design

Date: 2026-06-14

## Problem

Bulk/preorder customers cannot order more than the current stock. The cart clamps
quantity to available stock (`clampToStock`), so a product with `stock = 1`
(e.g. Pine Bottle, id 288) only ever adds 1 unit. Customers read this as a broken
site. The business wants to **accept oversold orders** and handle the shortfall on
the admin side via inbound restock.

## Goal

1. **Storefront — allow oversell.** Customers can add to cart and check out beyond
   available stock, including `stock = 0`. The ONLY hard block is `notForSale`.
2. **Admin order detail — warn on shortfall.** Items whose ordered quantity exceeds
   current stock are flagged in red ("재입고 필요"), and the order shows an order-level
   warning banner when any item is short.
3. **Packaging guard — never go negative.** Advancing an order into `packaging`
   (the point where stock is deducted) is blocked with a clear error if any item's
   quantity exceeds current stock. Admin must add inbound stock until
   `stock >= ordered qty` for every item, then packaging proceeds and deducts
   normally. Stock never displays as negative; no DB schema change.

## Non-goals

- No DB schema/migration change. The existing `decrement_stock_for_order` CHECK
  (stock >= 0) stays as a safety net; we add a friendly pre-check in front of it.
- No customer-facing stock numbers (only behavior changes + a "Backorder" label).
- "Iron not showing" and "Injections mobile pagination" are tracked separately,
  not part of this spec.

## Design

### 1. Storefront — allow oversell

- `lib/store.ts`: remove `clampToStock`. `addItem` always increments by 1;
  `updateQuantity` accepts any quantity > 0 (0 or less removes the line). No stock
  lookups in the store.
- `lib/useCartStock.ts`: remove the auto-clamp effect that reduces a line's
  quantity down to stock. Remove the `hasSoldOut` checkout block (checkout is never
  blocked by stock). Stock info may still be exposed for optional display, but is no
  longer a gate.
- `components/catalogue/ProductCard.tsx`, `ProductDetailClient.tsx`,
  `components/layout/CartPanel.tsx`: change the add/quantity disable condition from
  `soldOut || notForSale` to **`notForSale` only**. Stock 0 / low stock still adds.
- Labeling: the "SOLD OUT" badge no longer blocks. When `stock <= 0` show a
  non-blocking **"Backorder / 재입고 예정"** label; `notForSale` keeps its
  "Not for sale" hard-block label and disabled button.

### 2. Admin order detail — shortfall warning

File: `app/manzura/orders/[id]/page.tsx`

- Fetch current stock for the order's `product_id`s via `getStockMap` alongside the
  existing queries.
- Per item row: if `quantity > stock`, render the stock value in red with a
  "재입고 필요 (need N more)" badge.
- Order-level: if any item is short, render a red warning banner near the top of the
  order ("재고 초과 품목 N개 — 재입고 후 packaging 가능").

### 3. Packaging guard

Files: `app/manzura/orders/actions.ts`, `components/admin/AdminOrderStatusPanel.tsx`

- In the status-update action, on the forward crossing into `packaging`-or-beyond
  (the existing deduction branch), BEFORE deducting:
  - Load current stock for all items.
  - If any item has `quantity > stock`, return an error result (no deduction, no
    status change) listing the short items and how many units each needs.
- `AdminOrderStatusPanel` surfaces that error as a visible warning instead of
  silently failing or throwing a raw DB error.
- After admin adds inbound stock so every item satisfies `stock >= quantity`,
  pressing "mark packaging" succeeds and deducts as before.

## Verification

Push to `main` → auto-deploy → verify on the live site:
1. Add > stock (and a stock-0 item) to cart, check out — succeeds.
2. `notForSale` item — still cannot add.
3. Admin order detail — over-stock items red + order banner shows.
4. "mark packaging" on an oversold order — blocked with warning; after inbound
   restock, succeeds and stock is correct (never negative).
