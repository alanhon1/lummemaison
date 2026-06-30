# Stock Hard-Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap every customer order quantity at the item's available stock — on the product page, in the cart, and authoritatively at order time — so stock can never be oversold by a single customer, and stock-0 / unknown items become request-only.

**Architecture:** One pure rule, `orderableCap(product, flags) → number`, is the single source of truth for "max units a customer may order for this (product, option)". It folds every block rule into one number: notForSale / not-available-for-order / stock_unknown / wonder all yield `0`; otherwise the real stock integer. A new `POST /api/products/caps` returns this number per cart line; a client `cap-store` batches those lookups; the cart UIs disable the `+` at the cap and offer "Make a request"; a layout-mounted `CartStockGuard` clamps any pre-existing oversold cart on load; and `createOrder` re-applies `orderableCap` server-side as the authoritative gate. This **supersedes** the 2026-06-14 oversell design.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), React 19, zustand 5 (persisted cart in `localStorage` as `lumiere-cart`), Supabase (`product_stock` keyed by `(product_id, option)`), next-intl, Tailwind v4, lucide-react.

## Global Constraints

- **No DB schema/migration change.** The DB floor (`decrement_stock_for_order`, migration 034) stays as the deferred-concurrency safety net.
- **Concurrency / stock reservation is OUT OF SCOPE.** Stock is still decremented at the admin `packaging` step. Two customers can each pass the guard for the same units; the second is caught at packaging. Single-customer oversell is fully prevented.
- **No unit-test runner exists** (only `node_modules/**/*.test.ts`). "Verify" means `npm run build` passes (TypeScript typecheck) plus the stated manual check. Final deploy/verify is push-to-`main` → auto-deploy → check the live site.
- **`orderableCap` is the ONLY place the cap rule lives.** Product page, caps API, and `createOrder` all call it. Never re-implement the rule inline.
- **`stockKey(id, option)` is `` `${id} ${option}` `` (space-separated)**; `capKey(id, option)` is `` `${id}::${option}` ``. Do not mix them.
- **Customer-facing copy in these components is hardcoded English** (matching the existing strings like "Out of stock", "Remove unavailable items to check out"). Keep new copy English; no new i18n keys in this plan.
- **A cap is only acted on when it is a known `number`.** A `undefined` cap (still loading / fetch failed) must never remove or clamp a line — same safety rule the availability store already follows.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: `orderableCap` + `capKey` shared helpers

The single source of truth for the cap rule, plus a tiny pure key helper shared by the API route and the client store.

**Files:**
- Create: `lib/products/capKey.ts`
- Modify: `lib/products/stock.ts` (add `orderableCap`; imports near top, function near the other helpers)

**Interfaces:**
- Produces: `capKey(id: number, option?: string): string` → `` `${id}::${option ?? ''}` ``
- Produces: `orderableCap(product: Pick<Product,'notForSale'|'available_for_order'|'outOfStock'> | undefined, flags: StockFlags | undefined): number`
- Consumes: `purchaseBlockReason` (from `@/lib/products`), `StockFlags` (already defined in `stock.ts`).

- [ ] **Step 1: Create the `capKey` helper**

Create `lib/products/capKey.ts`:

```ts
// Stable identity for a (product, option) cap, shared by the caps API route and
// the client cap store. Always includes the option slot (unlike cartLineKey,
// which omits it for optionless products) so both sides agree on the lookup key.
export function capKey(id: number, option?: string): string {
  return `${id}::${option ?? ''}`;
}
```

- [ ] **Step 2: Add `orderableCap` to `stock.ts`**

In `lib/products/stock.ts`, add this import directly under the existing `createServiceClient` import (line 5):

```ts
import { purchaseBlockReason, type Product } from '@/lib/products';
```

Then add the function immediately after the `StockFlags` interface / `stockKey` helper (after line 12):

```ts
// The orderable cap for one (product, option): the maximum quantity a customer
// may order. Single source of truth for the hard-cap rule — folds every block
// into one number:
//   - product missing (deleted), notForSale, or not available_for_order ⇒ 0
//   - option stock_unknown or wonder (no real count tracked) ⇒ 0
//   - otherwise ⇒ the real stock integer (0 ⇒ not orderable, request only)
export function orderableCap(
  product: Pick<Product, 'notForSale' | 'available_for_order' | 'outOfStock'> | undefined,
  flags: StockFlags | undefined,
): number {
  if (!product || purchaseBlockReason(product) !== null) return 0;
  if (!flags || flags.stockUnknown || flags.wonder) return 0;
  return Math.max(0, Math.floor(flags.stock));
}
```

- [ ] **Step 3: Verify build (typecheck)**

Run: `npm run build`
Expected: build completes with no TypeScript errors. (A pre-existing circular-import warning would surface here — there is none: `lib/products.ts` does not import `lib/products/stock.ts`.)

- [ ] **Step 4: Commit**

```bash
git add lib/products/capKey.ts lib/products/stock.ts
git commit -m "feat(stock): orderableCap rule + capKey helper

Single source of truth for the per-(product,option) order cap.
notForSale/unavailable/stock_unknown/wonder all map to 0.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `POST /api/products/caps` route

Returns the orderable cap per requested (product, option), keyed by `capKey`, for the client cart to read.

**Files:**
- Create: `app/api/products/caps/route.ts`

**Interfaces:**
- Consumes: `orderableCap`, `stockKey`, `getStockFlagsMap` (`@/lib/products/stock`), `capKey` (`@/lib/products/capKey`), `getAllProducts` (`@/lib/catalogue`).
- Produces: `POST /api/products/caps` — request body `{ keys: Array<{ product_id: number; option?: string }> }`; response `Record<string, number>` keyed by `capKey(product_id, option)`.

- [ ] **Step 1: Create the route**

Create `app/api/products/caps/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/catalogue';
import { getStockFlagsMap, orderableCap, stockKey } from '@/lib/products/stock';
import { capKey } from '@/lib/products/capKey';

export const dynamic = 'force-dynamic';

// Per-(product, option) orderable cap for the cart. The cart lives in the
// browser (localStorage) and holds (id, option) lines; this returns the max
// quantity each line may hold so the UI can disable "+" at the cap and offer a
// request instead. The authoritative cap is re-checked in createOrder — this
// only drives the cart UI. Body: { keys: [{ product_id, option }] }.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const rawKeys = Array.isArray((body as { keys?: unknown })?.keys)
    ? (body as { keys: unknown[] }).keys
    : [];
  const keys = rawKeys
    .map(k => ({
      product_id: Number((k as { product_id?: unknown })?.product_id),
      option: typeof (k as { option?: unknown })?.option === 'string'
        ? ((k as { option: string }).option)
        : '',
    }))
    .filter(k => Number.isFinite(k.product_id))
    .slice(0, 500);
  if (keys.length === 0) return NextResponse.json({});

  const [products, flagsMap] = await Promise.all([
    getAllProducts(),
    getStockFlagsMap(keys.map(k => ({ product_id: k.product_id, option: k.option }))),
  ]);
  const byId = new Map(products.map(p => [p.id, p]));

  const out: Record<string, number> = {};
  for (const k of keys) {
    const flags = flagsMap[stockKey(k.product_id, k.option)];
    out[capKey(k.product_id, k.option)] = orderableCap(byId.get(k.product_id), flags);
  }
  return NextResponse.json(out);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build passes; route `/api/products/caps` appears in the route manifest output.

- [ ] **Step 3: Manual smoke check (local)**

Run `npm run dev`, then in a second terminal:
`curl -s -X POST http://localhost:3000/api/products/caps -H "content-type: application/json" -d '{"keys":[{"product_id":288,"option":""}]}'`
Expected: a JSON object like `{"288::":N}` where `N` is that product's real stock (or `0` if notForSale/unknown/wonder/out). Confirm the key format is `id::option`.

- [ ] **Step 4: Commit**

```bash
git add app/api/products/caps/route.ts
git commit -m "feat(api): POST /api/products/caps returns per-line order cap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Client cap store + `useCartCaps` hook

Batches the cart's (id, option) lines into one POST and exposes the cap per line. Mirrors the existing `availability-store` batching pattern.

**Files:**
- Create: `lib/cap-store.ts`

**Interfaces:**
- Consumes: `useCartStore` (`./store`), `capKey` (`./products/capKey`), `POST /api/products/caps`.
- Produces:
  - `useCapStore` — zustand store with `map: Record<string, number | undefined>` and `ensureLoaded(id: number, option?: string): void`.
  - `useCartCaps(): { capOf: (item: { id: number; option?: string }) => number | undefined }`.

- [ ] **Step 1: Create the store + hook**

Create `lib/cap-store.ts`:

```ts
'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { useCartStore } from './store';
import { capKey } from './products/capKey';

interface CapStore {
  // capKey(id, option) -> cap. `undefined` = not yet known. Consumers must NOT
  // treat unknown as 0 (a slow/failed fetch must never clamp or drop a line).
  map: Record<string, number | undefined>;
  ensureLoaded: (id: number, option?: string) => void;
}

const pending = new Map<string, { product_id: number; option: string }>();
let scheduled = false;

async function flush(set: (fn: (state: CapStore) => Partial<CapStore>) => void) {
  if (pending.size === 0) return;
  const entries = Array.from(pending.values());
  pending.clear();
  scheduled = false;
  try {
    const res = await fetch('/api/products/caps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ keys: entries }),
    });
    if (!res.ok) return; // leave entries unknown
    const data = (await res.json()) as Record<string, number>;
    set(state => {
      const next = { ...state.map };
      for (const e of entries) {
        const key = capKey(e.product_id, e.option);
        const v = data[key];
        if (typeof v === 'number') next[key] = v;
      }
      return { map: next };
    });
  } catch {
    // Network errors are non-fatal — lines stay "unknown" (never clamped). The
    // authoritative createOrder guard still refuses an oversized order.
  }
}

export const useCapStore = create<CapStore>((set, get) => ({
  map: {},
  ensureLoaded(id, option = '') {
    const key = capKey(id, option);
    if (get().map[key] !== undefined) return;
    pending.set(key, { product_id: id, option });
    if (!scheduled) {
      scheduled = true;
      // Batch every (id, option) requested in the current tick into one POST.
      Promise.resolve().then(() => flush(set));
    }
  },
}));

export interface CartCapsInfo {
  // Max orderable quantity for a cart line, or undefined while loading.
  capOf: (item: { id: number; option?: string }) => number | undefined;
}

// Loads the orderable cap for every cart line so the cart/checkout can disable
// the "+" button at the cap and offer a request instead.
export function useCartCaps(): CartCapsInfo {
  const items = useCartStore(s => s.items);
  const map = useCapStore(s => s.map);
  const ensureLoaded = useCapStore(s => s.ensureLoaded);

  useEffect(() => {
    for (const i of items) ensureLoaded(i.id, i.option ?? '');
  }, [items, ensureLoaded]);

  const capOf = (item: { id: number; option?: string }) => map[capKey(item.id, item.option ?? '')];
  return { capOf };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build passes, no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/cap-store.ts
git commit -m "feat(cart): client cap store + useCartCaps hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Product-page enforcement (cap the optionStock + block add at cap)

Make the product page treat the cap (not raw stock) as the gate, and block adding when the selected option's units are already all in the cart.

**Files:**
- Modify: `app/[locale]/product/[id]/page.tsx:42-45`
- Modify: `components/catalogue/ProductDetailClient.tsx`

**Interfaces:**
- Consumes: `orderableCap` (`@/lib/products/stock`), `getProductOptionStock` (already imported in `page.tsx`), `useCartStore`, `cartLineKey` (`@/lib/store`).
- The `optionStock` prop already passed to `ProductDetailClient` becomes a **capped** number per option (its name/shape is unchanged: `Record<string, number>`), so `selectedStock <= 0` now means "not orderable" for unknown/wonder/notForSale too.

- [ ] **Step 1: Cap the per-option stock in the server component**

In `app/[locale]/product/[id]/page.tsx`, add `orderableCap` to the existing stock import (it currently imports `getProductOptionStock`); find that import line and add `orderableCap`, e.g.:

```ts
import { getProductOptionStock, orderableCap } from '@/lib/products/stock';
```

Then replace lines 42-45:

```ts
  const optionStockRows = await getProductOptionStock(product.id);
  const optionStock: Record<string, number> = Object.fromEntries(
    optionStockRows.map(r => [r.option, r.stock]),
  );
```

with (apply the cap rule per option — `r` already carries `{ stock, wonder, stockUnknown }`):

```ts
  const optionStockRows = await getProductOptionStock(product.id);
  const optionStock: Record<string, number> = Object.fromEntries(
    optionStockRows.map(r => [r.option, orderableCap(product, r)]),
  );
```

- [ ] **Step 2: Block add-to-cart at the cap in the client component**

In `components/catalogue/ProductDetailClient.tsx`:

Add `cartLineKey` to the cart import (line 7):

```ts
import { useCartStore, cartLineKey } from '@/lib/store';
```

Replace the cart-store destructure (line 24) to also read items:

```ts
  const { addItem } = useCartStore();
  const items = useCartStore(s => s.items);
```

After the existing gate block (right after line 44, the `blockLabel` line), add the in-cart / at-cap computation:

```ts
  // How many of the SELECTED line are already in the cart, and whether that
  // already uses up the cap. selectedStock is the orderableCap (server-capped),
  // so a wonder/unknown/notForSale option is selectedStock === 0 ⇒ outOfStock.
  const inCart = items.find(
    i => i.id === product.id && (i.option ?? '') === selectedKey,
  )?.quantity ?? 0;
  const atCap = !cannotBuy && selectedStock > 0 && inCart >= selectedStock;
```

Update `handleAddToCart` (lines 46-58) to also stop at the cap:

```ts
  function handleAddToCart() {
    if (cannotBuy || atCap) return;
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      specification: product.specification,
      ...(options.length > 0 ? { option: option || options[0] } : {}),
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }
```

Update the buy button `disabled` (line 92) and its className/label to account for `atCap`:

```tsx
      <button
        onClick={handleAddToCart}
        disabled={cannotBuy || atCap}
        className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 ${
          cannotBuy || atCap
            ? 'bg-charcoal text-cream cursor-not-allowed'
            : added
              ? 'bg-green-600 text-white border border-green-600'
              : 'btn-gold'
        }`}
      >
        {cannotBuy ? (
          <>{blockLabel}</>
        ) : atCap ? (
          <>Max in cart ({selectedStock})</>
        ) : added ? (
          <>
            <Check size={16} />
            Added to Cart
          </>
        ) : (
          <>
            <ShoppingBag size={16} />
            {tCat('addToCart')}
          </>
        )}
      </button>
```

Finally, generalize the out-of-stock request block (lines 122-136) so it also shows when the cap is reached. Replace the opening condition and copy:

```tsx
      {(outOfStock || atCap) && (
        <div className="rounded-md border border-bone bg-cream/60 p-3">
          <p className="text-xs text-charcoal mb-2">
            {outOfStock ? (
              <>
                <span className="font-semibold">Out of stock</span> — this item isn&apos;t available
                right now, please check back later.
              </>
            ) : (
              <>
                <span className="font-semibold">Only {selectedStock} in stock</span> — that&apos;s all
                in your cart. Need more? Make a request and we&apos;ll plan a restock.
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="btn-secondary text-xs px-4 py-2 inline-flex items-center justify-center"
          >
            Make a request
          </button>
        </div>
      )}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build passes, no type errors.

- [ ] **Step 4: Manual check (local `npm run dev`)**

1. Open a product whose stock is a small number N (use the admin stock editor or DB to set, e.g. N=2). Add to cart N times → button reads "Max in cart (N)" and is disabled; the "Only N in stock … Make a request" block shows.
2. Open a product/option that is `stock_unknown` or `wonder` → button is disabled and the "Out of stock / Make a request" block shows (cap 0).

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/product/[id]/page.tsx" components/catalogue/ProductDetailClient.tsx
git commit -m "feat(product): hard-cap add-to-cart at available stock

Per-option stock is now the orderableCap; wonder/unknown ⇒ request-only.
Blocks adding past the cap and offers Make a request.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Cart drawer (`CartPanel`) — cap the `+` and offer a request

**Files:**
- Modify: `components/layout/CartPanel.tsx`

**Interfaces:**
- Consumes: `useCartCaps` (`@/lib/cap-store`), `RequestModal` (`@/components/catalogue/RequestModal`), `CartItem` (`@/lib/store`).
- Per line: `cap = capOf(item)`, `atCap = typeof cap === 'number' && item.quantity >= cap`.

- [ ] **Step 1: Wire imports + hook + request state**

In `components/layout/CartPanel.tsx`:

Add imports near the existing ones (after line 12):

```ts
import { useCartCaps } from '@/lib/cap-store';
import RequestModal from '@/components/catalogue/RequestModal';
import type { CartItem } from '@/lib/store';
```

Inside the component, after the `useCartAvailability` line (line 18), add:

```ts
  const { capOf } = useCartCaps();
  const [requestItem, setRequestItem] = useState<CartItem | null>(null);
```

- [ ] **Step 2: Compute the cap inside the items map + disable `+`**

In the items map, just after `const lineKey = cartLineKey(item);` (line 68), add:

```ts
                const cap = capOf(item);
                const atCap = typeof cap === 'number' && item.quantity >= cap;
```

Replace the `+` button (lines 117-122) with a cap-aware version:

```tsx
                      <button
                        onClick={() => { if (!atCap) updateQuantity(lineKey, item.quantity + 1); }}
                        disabled={atCap}
                        className={`w-6 h-6 border border-bone rounded-sm flex items-center justify-center transition-colors ${
                          atCap ? 'opacity-40 cursor-not-allowed' : 'hover:border-gold hover:text-gold'
                        }`}
                      >
                        <Plus size={10} />
                      </button>
```

- [ ] **Step 3: Show the "only N left / request more" line**

Directly after the quantity row's closing `</div>` (the `flex items-center gap-2 mt-2` block ends at line 130), add an at-cap notice inside the line's Info column:

```tsx
                    {atCap && (
                      <button
                        type="button"
                        onClick={() => setRequestItem(item)}
                        className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-gold-dark hover:text-gold"
                      >
                        Only {cap} in stock · Request more
                      </button>
                    )}
```

- [ ] **Step 4: Render the request modal once**

Just before the final closing `</aside>` (line 179), add:

```tsx
        {requestItem && (
          <RequestModal
            productId={requestItem.id}
            productName={requestItem.name}
            option={requestItem.option}
            onClose={() => setRequestItem(null)}
          />
        )}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build passes, no type errors.

- [ ] **Step 6: Manual check**

With a stock-N product in the cart, open the drawer: the `+` disables at quantity N, and "Only N in stock · Request more" appears and opens the request modal.

- [ ] **Step 7: Commit**

```bash
git add components/layout/CartPanel.tsx
git commit -m "feat(cart): cap quantity in drawer + Request more at the cap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Cart page (`CartPageClient`) — cap the `+` and offer a request

Mirror of Task 5 for the full cart page.

**Files:**
- Modify: `components/checkout/CartPageClient.tsx`

**Interfaces:**
- Consumes: `useCartCaps` (`@/lib/cap-store`), `RequestModal` (`@/components/catalogue/RequestModal`), `CartItem` (`@/lib/store`).

- [ ] **Step 1: Wire imports + hook + request state**

In `components/checkout/CartPageClient.tsx`:

Add imports after line 11:

```ts
import { useCartCaps } from '@/lib/cap-store';
import RequestModal from '@/components/catalogue/RequestModal';
import type { CartItem } from '@/lib/store';
```

After the `useCartAvailability` line (line 17), add:

```ts
  const { capOf } = useCartCaps();
  const [requestItem, setRequestItem] = useState<CartItem | null>(null);
```

- [ ] **Step 2: Compute the cap in the map + disable `+`**

After `const lineKey = cartLineKey(item);` (line 39), add:

```ts
          const cap = capOf(item);
          const atCap = typeof cap === 'number' && item.quantity >= cap;
```

Replace the `+` button (lines 72-77):

```tsx
                <button
                  onClick={() => { if (!atCap) updateQuantity(lineKey, item.quantity + 1); }}
                  disabled={atCap}
                  className={`w-7 h-7 border border-bone rounded-sm flex items-center justify-center transition-colors ${
                    atCap ? 'opacity-40 cursor-not-allowed' : 'hover:border-gold hover:text-gold'
                  }`}
                >
                  <Plus size={11} />
                </button>
```

- [ ] **Step 3: Show the "only N left / request more" line**

Immediately after the quantity row `</div>` (closes at line 78), add inside the info column:

```tsx
              {atCap && (
                <button
                  type="button"
                  onClick={() => setRequestItem(item)}
                  className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-gold-dark hover:text-gold"
                >
                  Only {cap} in stock · Request more
                </button>
              )}
```

- [ ] **Step 4: Render the request modal once**

Just before the component's final closing `</div>` (line 164, the outer grid), add:

```tsx
      {requestItem && (
        <RequestModal
          productId={requestItem.id}
          productName={requestItem.name}
          option={requestItem.option}
          onClose={() => setRequestItem(null)}
        />
      )}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build passes, no type errors.

- [ ] **Step 6: Commit**

```bash
git add components/checkout/CartPageClient.tsx
git commit -m "feat(cart): cap quantity on cart page + Request more at the cap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `CartStockGuard` — clamp pre-existing oversold carts on load

Customers already hold `localStorage` carts with `quantity > cap` (or now-unorderable lines). Clamp them down to the cap (cap 0 ⇒ line removed) when caps load, and show a one-time notice. Mounted in the layout next to `CartPanel`.

**Files:**
- Create: `components/cart/CartStockGuard.tsx`
- Modify: `app/[locale]/layout.tsx:64`

**Interfaces:**
- Consumes: `useCartStore`, `cartLineKey` (`@/lib/store`), `useCartCaps` + `useCapStore` (`@/lib/cap-store`), `capKey` (`@/lib/products/capKey`).
- Renders `null` until a clamp happens, then a dismissible fixed banner.

- [ ] **Step 1: Create the guard**

Create `components/cart/CartStockGuard.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useCartStore, cartLineKey } from '@/lib/store';
import { useCartCaps, useCapStore } from '@/lib/cap-store';
import { capKey } from '@/lib/products/capKey';

// Mounted once in the layout. When live caps load, it clamps any persisted cart
// line whose quantity exceeds its orderableCap (a cap-0 line is removed, since
// updateQuantity(<=0) drops the line) and shows a one-time notice. Only acts on
// KNOWN numeric caps — a still-loading/failed cap (undefined) never clamps.
export default function CartStockGuard() {
  const items = useCartStore(s => s.items);
  const updateQuantity = useCartStore(s => s.updateQuantity);
  const map = useCapStore(s => s.map);
  const [adjusted, setAdjusted] = useState(false);

  // Trigger the batched cap load for every cart line.
  useCartCaps();

  useEffect(() => {
    let changed = false;
    for (const item of items) {
      const cap = map[capKey(item.id, item.option ?? '')];
      if (typeof cap === 'number' && item.quantity > cap) {
        updateQuantity(cartLineKey(item), cap); // cap 0 ⇒ line removed
        changed = true;
      }
    }
    if (changed) setAdjusted(true);
  }, [items, map, updateQuantity]);

  useEffect(() => {
    if (!adjusted) return;
    const id = setTimeout(() => setAdjusted(false), 6000);
    return () => clearTimeout(id);
  }, [adjusted]);

  if (!adjusted) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 rounded-md bg-charcoal px-4 py-3 text-xs text-cream shadow-lg">
      <span>Some quantities were adjusted to match available stock.</span>
      <button onClick={() => setAdjusted(false)} aria-label="Dismiss" className="text-cream/70 hover:text-cream">
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the layout**

In `app/[locale]/layout.tsx`, line 64 currently renders `<CartPanel />`. Add the guard import near the other imports, then mount the guard next to the panel:

```tsx
        <CartPanel />
        <CartStockGuard />
```

Add the import (match the existing import style/path for `CartPanel` in that file):

```ts
import CartStockGuard from '@/components/cart/CartStockGuard';
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build passes, no type errors.

- [ ] **Step 4: Manual check**

1. With the app on the OLD behavior, add 5 units of a product to the cart. 2. Set that product's stock to 2 (admin/DB). 3. Reload any page: the cart line drops to 2 and the "Some quantities were adjusted…" banner appears for ~6s. 4. Set stock to 0 → reload → the line is removed entirely.

- [ ] **Step 5: Commit**

```bash
git add components/cart/CartStockGuard.tsx "app/[locale]/layout.tsx"
git commit -m "feat(cart): clamp pre-existing oversold carts to stock on load

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Authoritative server guard in `createOrder`

The one gate the client can't bypass: reject any line whose quantity exceeds its `orderableCap`. Replaces the old "block only when stock ≤ 0" check and removes the "oversell is allowed" stance.

**Files:**
- Modify: `app/[locale]/checkout/actions.ts` (import line 8; guard lines 205-222; comment lines 245-249)

**Interfaces:**
- Consumes: `orderableCap` (added to the existing `@/lib/products/stock` import), `stockKey`, `getStockFlagsMap` (already imported), `purchaseBlockReason` (already imported), `getAllProducts` (already imported).
- The `optionStock` local (line 202) is the `getStockFlagsMap` result (`Record<stockKey, StockFlags>`); pass each line's flags straight into `orderableCap`.

- [ ] **Step 1: Add `orderableCap` to the stock import**

In `app/[locale]/checkout/actions.ts`, change line 8:

```ts
import { getStockFlagsMap, orderableCap, stockKey } from '@/lib/products/stock';
```

- [ ] **Step 2: Replace the per-line guard with a cap+quantity check**

Replace the `blockedLines` filter and its error (lines 205-222):

```ts
  const blockedLines = input.items.filter(l => {
    const p = liveById.get(l.product_id);
    // Sold-out is checked PER (product, option): a product with option A=0 but
    // option B in stock must not let an A line through (previously this used the
    // per-product total, so a sold-out option could be ordered then stall at the
    // per-option packaging guard — a paid-then-rejected order).
    const optStock = optionStock[stockKey(l.product_id, l.option?.trim() || '')]?.stock ?? 0;
    // Blocked if: product is gone, not-for-sale / switched off, OR that option
    // is out of stock (0 real stock — sold out since it was added to the cart).
    return !p || purchaseBlockReason(p) !== null || optStock <= 0;
  });
  if (blockedLines.length > 0) {
    const names = [...new Set(blockedLines.map(l => l.product_name))].join(', ');
    return {
      ok: false,
      error: `These items are no longer available for purchase and must be removed from your cart before you can order: ${names}`,
    };
  }
```

with the cap-aware guard (the client cart is never trusted — re-apply `orderableCap` and refuse any over-cap line):

```ts
  // AUTHORITATIVE hard-cap guard. orderableCap folds every rule into one number
  // (notForSale / unavailable / stock_unknown / wonder ⇒ 0; else the real stock).
  // Refuse the whole order if any line's quantity exceeds its cap. This is the
  // one place that actually closes the "already in cart" / forged-cart bypass —
  // single-customer oversell can never get past here.
  const overCapLines = input.items.filter(l => {
    const flags = optionStock[stockKey(l.product_id, l.option?.trim() || '')];
    return l.quantity > orderableCap(liveById.get(l.product_id), flags);
  });
  if (overCapLines.length > 0) {
    const detail = overCapLines
      .map(l => {
        const flags = optionStock[stockKey(l.product_id, l.option?.trim() || '')];
        const cap = orderableCap(liveById.get(l.product_id), flags);
        const name = l.product_name + (l.option ? ` (${l.option})` : '');
        return cap <= 0
          ? `${name}: no longer available`
          : `${name}: only ${cap} available (your cart has ${l.quantity})`;
      })
      .join('; ');
    return {
      ok: false,
      error: `Some items exceed available stock — please adjust your cart before ordering: ${detail}`,
    };
  }
```

- [ ] **Step 3: Remove the stale "oversell allowed" comment**

Delete the now-false comment block at lines 245-249:

```ts
  // Oversell is allowed by design: customers may order beyond available stock
  // (including stock 0 — a backorder). We deliberately do NOT block order
  // creation on stock here. The shortfall is surfaced on the admin order detail
  // and enforced at fulfilment: advancing the order into "packaging" is blocked
  // until the item is restocked, so real stock never goes negative.
```

Replace it with a one-line pointer:

```ts
  // Stock hard-cap is enforced above (orderableCap guard). The admin packaging
  // guard + DB floor (migration 034) remain as the deferred-concurrency net.
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build passes; `purchaseBlockReason` may now be unused in this file — if the typecheck/lint flags it, remove it from the import on line 7. (It is still used by `orderableCap` internally, not directly here.)

- [ ] **Step 5: Manual check (forged/stale cart)**

1. Put a product with stock 2 into the cart, then via DevTools edit `localStorage` `lumiere-cart` to set that line's `quantity` to 9 (simulating a stale/forged cart, bypassing the UI cap). 2. Attempt checkout → `createOrder` returns "Some items exceed available stock … only 2 available (your cart has 9)" and **no order is created**. 3. With the line at quantity 2, checkout succeeds.

- [ ] **Step 6: Commit**

```bash
git add "app/[locale]/checkout/actions.ts"
git commit -m "feat(checkout): reject over-cap lines in createOrder (no oversell)

Authoritative hard cap via orderableCap; supersedes the oversell stance.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification (live)

Per the project workflow (push to `main` → auto-deploy), after all tasks merge, verify on the live site:

1. **Product page:** stock-N product caps add-to-cart at N with "Make a request"; `stock_unknown`/`wonder`/`notForSale` option is request-only.
2. **Cart drawer + cart page:** `+` stops at N; "Only N in stock · Request more" opens the request modal.
3. **Per-option:** a product with one sold-out option and one in-stock option caps each independently.
4. **Stale cart:** a forged `lumiere-cart` over-cap line is rejected by `createOrder` with a clear message; no order created.
5. **Existing cart cleanup:** an over-cap line is clamped down (cap 0 removed) on load with the adjustment banner.
6. **Regression:** `notForSale` item still cannot be added; a normal in-stock order of quantity ≤ stock checks out and deducts correctly at packaging (never negative).

## Spec Coverage Check

- Hard-cap on product page → Task 4. Cart drawer → Task 5. Cart page → Task 6. Server authoritative → Task 8. ✓
- Stock 0 / unknown / wonder ⇒ request-only → `orderableCap` (Task 1), surfaced in Tasks 4–6, enforced in Task 8. ✓
- Cap-reached message + request button → Tasks 4, 5, 6 (reuse `RequestModal`). ✓
- Per-option accuracy → `capKey`/`stockKey` per (id, option) across Tasks 1–8. ✓
- Existing oversold carts clamped + notice → Task 7. ✓
- Supersede oversell design / keep admin safety net → Task 8 (comment) + Global Constraints. ✓
- Concurrency deferred → Global Constraints (non-goal). ✓
