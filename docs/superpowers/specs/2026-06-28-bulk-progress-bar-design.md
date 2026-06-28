# Bulk-Discount Awareness Progress Bar — Design

**Date:** 2026-06-28
**Enhancement to:** lumee3 ① (bulk-order quote flow, already shipped)

## Goal
Make customers aware the **15% bulk discount at $2,500+** exists, before they reach the payment step. Show a gold progress bar in the cart (drawer + page) that fills toward $2,500 and celebrates (subtly) when reached.

## Decisions
- **Placement:** cart drawer (`CartPanel`) **and** cart page (`CartPageClient`) — one shared component.
- **Style:** subtle luxury — gold gradient fill, soft glow + a single pulse the moment the threshold is crossed. No confetti (off-brand).
- **Currency:** amounts shown in **USD** (the bulk threshold is a fixed USD wholesale milestone; matches the cart page's USD display and the discount's definition). Progress is computed from the USD subtotal.
- **Informational only:** the bar motivates/announces; the actual A/B choice stays at the existing payment-step gate. No discount logic duplicated.
- **Mobile-first:** full-width, legible on small screens (text wraps, adequate bar height, touch-safe spacing).

## Component
`components/cart/BulkProgressBar.tsx` (`'use client'`, no props):
- Reads `useCartStore().totalPrice()` → USD subtotal (dollars).
- `THRESHOLD = BULK_THRESHOLD_CENTS / 100` (= 2500) from `@/lib/checkout/bulk` (single source).
- `pct = min(100, subtotal / THRESHOLD * 100)`, `remaining = max(0, THRESHOLD − subtotal)`, `unlocked = subtotal >= THRESHOLD`.
- Renders nothing when the cart is empty (`subtotal <= 0`).
- Below: gold gradient bar at `pct%` + `t('cart.bulk.progress', { amount: '$' + remaining })`.
- Unlocked: full bar + glow + `t('cart.bulk.unlocked')`.
- Fill animates via CSS `width` transition. A one-time glow/pulse fires only when `unlocked` flips false→true (track previous value); re-render while staying unlocked does not re-pulse.

## Edits
- `components/layout/CartPanel.tsx` — render `<BulkProgressBar />` in the footer, above the total row.
- `components/checkout/CartPageClient.tsx` — render `<BulkProgressBar />` in the Order Summary, above the total row.
- `messages/en.json` + `messages/ru.json` — `cart.bulk.progress` (with `{amount}`) and `cart.bulk.unlocked`.

## Verification
- `tsc --noEmit` + `next build` pass.
- Cart < $2,500: bar fills proportionally, shows "Add $X more…". At/above: full bar + unlocked message + one pulse on crossing. Empty cart: no bar. Renders well on mobile width. Visible in both drawer and page.
