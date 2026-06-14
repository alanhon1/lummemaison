# Per-Option Stock + Remove Customer Stock Labels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track stock per `(product_id, option)` in the admin (with wonder/??? /history/packaging-guard all option-aware), and remove all customer-facing stock labels so the storefront never shows backorder/sold-out.

**Architecture:** Extend `product_stock` and `stock_movements` with an `option` column (option `''` = optionless, unchanged). All stock reads/writes, the decrement RPC, the packaging guard, and the admin UI become keyed by `(product_id, option)`. The storefront drops stock display entirely (oversell already lets everything be ordered). Finish the Skin Global import for the 11 held option products.

**Tech Stack:** Next.js 16 App Router, Supabase (service client + a plpgsql RPC), React 19. No unit-test runner — verify with `npx tsc --noEmit`, `npm run lint`, `npm run build`, the matcher's console output, and manual admin checks. DB migrations are run by the owner in the Supabase SQL editor.

**Spec:** `docs/superpowers/specs/2026-06-14-per-option-stock-design.md`

**Ship order (after code is merged):** owner runs migration `027` in Supabase → deploy → run the option-aware import SQL.

---

## File Structure

- **Create** `supabase/migrations/027_per_option_stock.sql` — option column on both tables + new decrement RPC (owner runs).
- **Modify** `lib/products/stock.ts` — all helpers keyed by `(productId, option)`.
- **Modify** `app/manzura/orders/actions.ts` — deduct/restore/guard per `(product_id, option)`.
- **Modify** `app/[locale]/checkout/actions.ts` — pass `option` when deducting (only if it deducts; deduction is at payment-verify in orders/actions.ts — confirm during Task 4).
- **Modify** storefront components to remove stock labels: `components/catalogue/ProductStockStatus.tsx`, `ProductCard.tsx`, `ProductDetailClient.tsx`, `components/checkout/CartPanel.tsx`, `CartPageClient.tsx`.
- **Modify** `app/manzura/stock/page.tsx`, `components/admin/StockInput.tsx`, `components/admin/WonderToggle.tsx`, `components/admin/ProductStockDetails.tsx`, `app/manzura/products/[id]/page.tsx`, `app/manzura/products/page.tsx`, `components/admin/ProductsClient.tsx` — per-option admin stock.
- **Modify** `scripts/import-skin-global-stock.ts` + `scripts/skin-global-manual-map.json` — option-aware mappings for the 11 held rows; option-aware import SQL.
- **Modify (live catalogue)** `#399/#400/#401` — add `options`, set `notForSale: true` (via admin or a one-off live-store edit), then `sync-bundled-from-live`.

---

## Phase 1 — Remove customer-facing stock labels (independent, shippable first)

### Task 1: Strip stock display from the storefront

**Files:**
- Modify: `components/catalogue/ProductStockStatus.tsx`
- Modify: `components/catalogue/ProductCard.tsx`
- Modify: `components/catalogue/ProductDetailClient.tsx`
- Modify: `components/checkout/CartPanel.tsx`
- Modify: `components/checkout/CartPageClient.tsx`

Buy/qty buttons already gate only on `notForSale` (not stock), so removing stock display does not affect purchasing.

- [ ] **Step 1: ProductStockStatus — keep only the notForSale state**

Replace the body of `components/catalogue/ProductStockStatus.tsx` with:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import type { Product } from '@/lib/products';

// Customer-facing availability. Stock is admin-only now (oversell lets every
// in-sale product be ordered), so we only surface the hard "not for sale" block.
export default function ProductStockStatus({ product }: { product: Product }) {
  const t = useTranslations('product');
  if (!product.notForSale) return null;
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className="w-2 h-2 rounded-full bg-red-400" />
      <span className="text-xs font-semibold text-charcoal">{t('outOfStock')}</span>
    </div>
  );
}
```

- [ ] **Step 2: ProductCard — remove the backorder badge**

In `components/catalogue/ProductCard.tsx`, delete the `useCartStock`/`isBackorder` import and usage and the JSX that renders the amber backorder badge (search `backorder`). Keep any `notForSale` rendering. Remove the now-unused stock hook import.

- [ ] **Step 3: ProductDetailClient — remove backorder text**

In `components/catalogue/ProductDetailClient.tsx`, remove any `useCartStock`/`isBackorder`/`backorder` usage and the text that shows it. Leave `notForSale` handling and the option selector untouched.

- [ ] **Step 4: CartPanel + CartPageClient — remove the backorder label**

In both `components/layout/CartPanel.tsx` and `components/checkout/CartPageClient.tsx`:
- Remove `const { isBackorder } = useCartStock();` and the `import { useCartStock } ...` line.
- Remove the `const backorder = isBackorder(item.id);` line and the block:
  `{backorder && (<p ...>{t('backorder')}</p>)}`.

- [ ] **Step 5: Type-check + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean (no unused-import errors for the removed hooks).

- [ ] **Step 6: Commit**

```bash
git add components/catalogue/ProductStockStatus.tsx components/catalogue/ProductCard.tsx components/catalogue/ProductDetailClient.tsx components/layout/CartPanel.tsx components/checkout/CartPageClient.tsx
git commit -m "feat(storefront): remove customer-facing stock/backorder labels (oversell)"
```

---

## Phase 2 — Per-option schema + helpers

### Task 2: Migration 027 — option column + decrement RPC

**Files:**
- Create: `supabase/migrations/027_per_option_stock.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Per-option stock. option = '' means the whole product (optionless), which is
-- how every existing row behaves. wonder/stock_unknown now apply per option.
alter table public.product_stock
  add column if not exists option text not null default '';

-- Re-key on (product_id, option).
alter table public.product_stock drop constraint if exists product_stock_pkey;
alter table public.product_stock add primary key (product_id, option);

alter table public.stock_movements
  add column if not exists option text not null default '';

-- Option-aware decrement. items: [{product_id, quantity, option?}, ...]
create or replace function public.decrement_stock_for_order(items jsonb)
returns void language plpgsql as $$
declare
  it jsonb;
  pid bigint;
  qty integer;
  opt text;
  affected integer;
begin
  for it in select * from jsonb_array_elements(items) loop
    pid := (it->>'product_id')::bigint;
    qty := (it->>'quantity')::integer;
    opt := coalesce(it->>'option', '');
    if qty is null or qty <= 0 then
      raise exception 'invalid quantity for product %: %', pid, qty;
    end if;

    insert into public.product_stock (product_id, option, stock)
      values (pid, opt, 0)
      on conflict (product_id, option) do nothing;

    update public.product_stock
       set stock = stock - qty
     where product_id = pid and option = opt;

    get diagnostics affected = row_count;
    if affected = 0 then
      raise exception 'product %/option % not found in stock table', pid, opt;
    end if;
  end loop;
end;
$$;
```

- [ ] **Step 2: Commit (owner runs it in Supabase before deploy)**

```bash
git add supabase/migrations/027_per_option_stock.sql
git commit -m "feat(stock): migration 027 — per-option product_stock + decrement RPC"
```

### Task 3: Option-aware stock helpers

**Files:**
- Modify: `lib/products/stock.ts`

- [ ] **Step 1: Add a key type + helpers; make every function option-aware**

Replace the contents of `lib/products/stock.ts` with (preserves existing behavior when `option` is `''`):

```ts
// Server-side helpers for the product_stock table, keyed by (product_id, option).
// option = '' is the whole product (optionless), unchanged from before.

import { createServiceClient } from '@/lib/supabase/server';

export interface StockKey { product_id: number; option?: string }
export interface StockFlags { stock: number; wonder: boolean; stockUnknown: boolean }

const k = (id: number, option: string) => `${id} ${option}`;

// Reads stock+flags for the given (product_id, option) keys. Missing rows
// default to { stock: 0, wonder: false, stockUnknown: false }.
export async function getStockFlagsMap(keys: StockKey[]): Promise<Record<string, StockFlags>> {
  const out: Record<string, StockFlags> = {};
  for (const key of keys) out[k(key.product_id, key.option ?? '')] = { stock: 0, wonder: false, stockUnknown: false };
  if (keys.length === 0) return out;
  const supabase = createServiceClient();
  const ids = [...new Set(keys.map(key => key.product_id))];
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, option, stock, wonder, stock_unknown')
    .in('product_id', ids);
  if (error) { console.error('[stock] getStockFlagsMap failed', error.message); return out; }
  for (const r of data ?? []) {
    out[k(r.product_id as number, (r.option as string) ?? '')] = {
      stock: (r.stock as number) ?? 0,
      wonder: Boolean(r.wonder),
      stockUnknown: Boolean(r.stock_unknown),
    };
  }
  return out;
}

export function stockKey(productId: number, option = ''): string { return k(productId, option); }

// All rows for a product (every option). Used by the admin per-option view.
export async function getProductOptionStock(
  productId: number,
): Promise<Array<{ option: string; stock: number; wonder: boolean; stockUnknown: boolean }>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('option, stock, wonder, stock_unknown')
    .eq('product_id', productId);
  if (error) { console.error('[stock] getProductOptionStock failed', error.message); return []; }
  return (data ?? []).map(r => ({
    option: (r.option as string) ?? '',
    stock: (r.stock as number) ?? 0,
    wonder: Boolean(r.wonder),
    stockUnknown: Boolean(r.stock_unknown),
  }));
}

export async function getProductStock(productId: number, option = ''): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('product_stock')
    .select('stock')
    .eq('product_id', productId)
    .eq('option', option)
    .maybeSingle();
  return (data?.stock as number | undefined) ?? 0;
}

export async function setProductStock(productId: number, option: string, stock: number): Promise<{ ok: boolean; error?: string }> {
  const clamped = Math.max(0, Math.floor(stock));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('product_stock')
    .upsert({ product_id: productId, option, stock: clamped, stock_unknown: false }, { onConflict: 'product_id,option' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setProductWonder(productId: number, option: string, wonder: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = wonder
    ? await supabase.from('product_stock').upsert(
        { product_id: productId, option, wonder: true, stock_unknown: true, stock: 0 }, { onConflict: 'product_id,option' })
    : await supabase.from('product_stock').upsert(
        { product_id: productId, option, wonder: false, stock_unknown: false }, { onConflict: 'product_id,option' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deductStockForItems(
  items: Array<{ product_id: number; quantity: number; option?: string }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (items.length === 0) return { ok: true };
  const supabase = createServiceClient();
  const payload = items.map(i => ({ product_id: i.product_id, quantity: i.quantity, option: i.option ?? '' }));
  const { error } = await supabase.rpc('decrement_stock_for_order', { items: payload });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function restoreStockForItems(
  items: Array<{ product_id: number; quantity: number; option?: string }>,
): Promise<void> {
  if (items.length === 0) return;
  const supabase = createServiceClient();
  for (const item of items) {
    const opt = item.option ?? '';
    const { data: row } = await supabase
      .from('product_stock').select('stock').eq('product_id', item.product_id).eq('option', opt).maybeSingle();
    const newStock = ((row?.stock as number | null) ?? 0) + item.quantity;
    await supabase.from('product_stock')
      .upsert({ product_id: item.product_id, option: opt, stock: newStock }, { onConflict: 'product_id,option' });
  }
}
```

- [ ] **Step 2: Update all callers of the changed signatures**

`setProductStock` and `setProductWonder` now take `option` as the 2nd arg, and `getStockFlagsMap` takes `StockKey[]`. Fix every caller:
- `app/manzura/products/actions.ts` — `saveProductStockAction` / `toggleWonderAction` (Task 6).
- `app/manzura/stock/page.tsx`, `app/manzura/products/page.tsx`, `app/manzura/orders/[id]/page.tsx` — anything calling `getStockFlagsMap`/`getStockMap`. (Old `getStockMap` is removed — replace with `getStockFlagsMap` keyed reads or `getProductOptionStock`.)
- `app/manzura/stock/actions.ts` (`addInbound`, `addInboundBatch`) — these write `product_stock` by product_id; add `option: ''` to their upserts and to the `stock_movements` insert.

Run `npx tsc --noEmit` and fix each type error the signature change surfaces (the compiler enumerates them).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean after all callers updated.

- [ ] **Step 4: Commit**

```bash
git add lib/products/stock.ts app/manzura/stock/actions.ts
git commit -m "feat(stock): option-aware stock helpers + decrement payload"
```

---

## Phase 3 — Order deduction, restore, packaging guard per option

### Task 4: Option-aware order fulfilment

**Files:**
- Modify: `app/manzura/orders/actions.ts`
- Modify: `app/manzura/orders/[id]/page.tsx` (shortfall display)

- [ ] **Step 1: Pass option through deduct/restore**

In `app/manzura/orders/actions.ts`, every place that builds the items array for `deductStockForItems` / `restoreStockForItems` from `order_items` must include `option`. Change the select to include `option` and map it:

```ts
// when reading order_items for stock ops:
const items = (orderItems ?? []).map(i => ({
  product_id: i.product_id as number,
  quantity: i.quantity as number,
  option: (i.option as string | null) ?? '',
}));
```

(Find each `order_items` select used for stock; add `option` to the column list and the mapped object.)

- [ ] **Step 2: Make the packaging shortfall guard per (product_id, option)**

The guard compares ordered quantity vs current stock before allowing the cross into `packaging`. Change it to group by `(product_id, option)` and compare against the option's stock. Replace the stock-map read + shortfall computation with:

```ts
// Current stock per (product_id, option) for the order's lines.
const flags = await getStockFlagsMap(items.map(i => ({ product_id: i.product_id, option: i.option })));
const shortItems = items.filter(i => {
  const f = flags[stockKey(i.product_id, i.option)];
  return (f?.stock ?? 0) < i.quantity;
});
```

(Import `getStockFlagsMap, stockKey` from `@/lib/products/stock`. Keep the existing test-order skip and the "block crossing into packaging when shortItems.length > 0" logic.)

- [ ] **Step 3: Option in the admin order-detail shortfall display**

In `app/manzura/orders/[id]/page.tsx`, the per-item "재입고 필요" / Stock column compares ordered qty vs stock. Read stock per `(product_id, option)` using `getStockFlagsMap` keyed by each item's `(product_id, option)` and show the option's stock. (The order items list already has `option`.)

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/manzura/orders/actions.ts "app/manzura/orders/[id]/page.tsx"
git commit -m "feat(stock): deduct/restore/packaging-guard per (product,option)"
```

---

## Phase 4 — Admin per-option UI

### Task 5: Stock tab — per-option rows

**Files:**
- Modify: `app/manzura/stock/page.tsx`

- [ ] **Step 1: Build rows per (product, option)**

In the stock tab, the product list currently maps each product to one row. Change it so a product with `options` produces one row per option (label `name — option`), and an optionless product produces one row (`option = ''`). Read all `product_stock` rows (now including `option`, `wonder`, `stock_unknown`) and join by `(product_id, option)`:

```tsx
const { data: stockRows } = await supabase
  .from('product_stock')
  .select('product_id, option, stock, wonder, stock_unknown');
const rows = (stockRows ?? []) as Array<{ product_id: number; option: string; stock: number; wonder: boolean; stock_unknown: boolean }>;
const rowFor = (id: number, opt: string) => rows.find(r => r.product_id === id && r.option === opt);

let allRows = allProducts.flatMap(p => {
  const opts = (p.options && p.options.length > 0) ? p.options : [''];
  return opts.map(opt => ({
    id: p.id,
    name: opt ? `${p.name} — ${opt}` : (p.name as string),
    option: opt,
    stock: rowFor(p.id, opt)?.stock ?? 0,
    wonder: Boolean(rowFor(p.id, opt)?.wonder),
    unknown: Boolean(rowFor(p.id, opt)?.stock_unknown),
  }));
});
if (wonderOnly) allRows = allRows.filter(r => r.wonder);
allRows = allRows.sort(/* keep existing sort, by name/id/stock */);
```

Render rows exactly as today (the `(W)` mark, `???` for `unknown`, status). `ProductStockDetails` becomes `productId` + `option` (Task 5 step 2).

- [ ] **Step 2: Pass option into ProductStockDetails (history)**

`components/admin/ProductStockDetails.tsx` shows per-product movement history. Add an `option?: string` prop and filter `stock_movements` by `option` as well as `product_id` when an option is given. Pass `option={r.option}` from the stock-tab row.

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/manzura/stock/page.tsx components/admin/ProductStockDetails.tsx
git commit -m "feat(admin): per-option rows + history in stock tab"
```

### Task 6: Product detail + list — per-option editing

**Files:**
- Modify: `app/manzura/products/actions.ts`
- Modify: `components/admin/StockInput.tsx`
- Modify: `components/admin/WonderToggle.tsx`
- Modify: `app/manzura/products/[id]/page.tsx`
- Modify: `app/manzura/products/page.tsx` + `components/admin/ProductsClient.tsx`

- [ ] **Step 1: Option-aware server actions**

In `app/manzura/products/actions.ts`, add `option` params:

```ts
export async function saveProductStockAction(productId: number, option: string, stock: number): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) return { ok: false, error: 'Invalid product id.' };
  const oldStock = await getProductStock(productId, option);
  const result = await setProductStock(productId, option, stock);
  if (!result.ok) return result;
  const delta = Math.max(0, Math.floor(stock)) - oldStock;
  if (delta !== 0) {
    try {
      await createServiceClient().from('stock_movements').insert({ product_id: productId, option, delta, reason: 'adjustment' });
    } catch { /* best-effort */ }
  }
  return result;
}

export async function toggleWonderAction(productId: number, option: string, wonder: boolean): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) return { ok: false, error: 'Invalid product id.' };
  return setProductWonder(productId, option, wonder);
}
```

(Update the import to `getProductStock, setProductStock, setProductWonder`.)

- [ ] **Step 2: StockInput + WonderToggle take an `option` prop**

Add `option: string` to both components' props and pass it to `saveProductStockAction(productId, option, parsed)` / `toggleWonderAction(productId, option, next)`. Default `option=''`.

- [ ] **Step 3: Product detail renders one editor per option**

In `app/manzura/products/[id]/page.tsx`, fetch per-option flags and render a StockInput + WonderToggle per option (or one with `option=''` if none):

```tsx
import { getProductOptionStock } from '@/lib/products/stock';
// ...
const opts = (product.options && product.options.length > 0) ? product.options : [''];
const optionStock = await getProductOptionStock(numericId);
const flagsFor = (opt: string) => optionStock.find(o => o.option === opt) ?? { stock: 0, wonder: false, stockUnknown: false };
// render:
<div className="max-w-5xl mx-auto px-6 pt-6 space-y-4">
  {opts.map(opt => (
    <div key={opt || '_'} className="space-y-2">
      {opt && <p className="text-xs font-semibold text-mist uppercase tracking-widest">{opt}</p>}
      <StockInput productId={product.id} option={opt} initialStock={flagsFor(opt).stock} initialUnknown={flagsFor(opt).stockUnknown} />
      <WonderToggle productId={product.id} option={opt} initialWonder={flagsFor(opt).wonder} />
    </div>
  ))}
</div>
```

- [ ] **Step 4: Products list — show stock summed across options (display only)**

In `app/manzura/products/page.tsx`, the list's `stockMap` is a per-product number for the inline cell. Compute it as the **sum** of all options' stock (display only; editing happens on the detail page). Build wonder/unknown sets as "any option is wonder/unknown". Keep `ProductsClient` as-is otherwise (the inline edit cell on the list should be read-only or route to detail for option products — simplest: in `ProductsClient`, when a product has options, render the summed number as plain text linking to the detail page instead of `InlineStockCell`).

```tsx
const { data: stockRows } = await supabase.from('product_stock').select('product_id, option, stock, wonder, stock_unknown');
const stockMap: Record<number, number> = {};
const wonderIds: number[] = []; const unknownIds: number[] = [];
for (const r of stockRows ?? []) {
  stockMap[r.product_id] = (stockMap[r.product_id] ?? 0) + (r.stock ?? 0);
  if (r.wonder && !wonderIds.includes(r.product_id)) wonderIds.push(r.product_id);
  if (r.stock_unknown && !unknownIds.includes(r.product_id)) unknownIds.push(r.product_id);
}
```

In `ProductsClient.tsx`, pass an additional `optionProductIds: number[]` (ids where `product.options?.length`) and, for those, render the summed stock as a non-editable number (link to detail) instead of `InlineStockCell` — so list edits never silently write to `option=''`.

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/manzura/products/actions.ts components/admin/StockInput.tsx components/admin/WonderToggle.tsx "app/manzura/products/[id]/page.tsx" app/manzura/products/page.tsx components/admin/ProductsClient.tsx
git commit -m "feat(admin): per-option stock editing on product detail + list summary"
```

---

## Phase 5 — Finish the import (option-aware) + Sungshim

### Task 7: Catalogue options for Sungshim + option-aware import

**Files:**
- Modify (live catalogue): products `#399`, `#400`, `#401`
- Modify: `scripts/skin-global-manual-map.json` + `scripts/import-skin-global-stock.ts`

- [ ] **Step 1: Add options + notForSale to the 3 Sungshim products (live)**

Edit the live catalogue (admin product editor, or a one-off script writing the Storage `products.json`) so:
- `#400 Sungshim syringes`: `options: ["0.5mL/30G/8mm","0.5mL/31G/8mm","1mL/30G/8mm","1mL/31G/8mm"]`, `notForSale: true`
- `#399 Sungshim meso needles`: `options: ["30G/13mm","30G/4mm"]`, `notForSale: true`
- `#401 Sungshim PEN NEEDLES`: `options: ["32G/6mm"]`, `notForSale: true`

Then refresh the committed backup: `npx tsx scripts/sync-bundled-from-live.ts`.

- [ ] **Step 2: Extend the manual map to carry option**

Change the map format so a value can be `{ id, option }` (string `id` stays = whole product). In `scripts/import-skin-global-stock.ts`, when a mapping is an object, set `(id, option, qty)`. Add to `scripts/skin-global-manual-map.json` `mappings`:

```json
"REJUBEAU MESO NEEDLE 30G 13MM": { "id": 391, "option": "13mm" },
"REJUBEAU MESO NEEDLE 30G 4MM":  { "id": 391, "option": "4mm" },
"REJUBEAU MESO NEEDLE 33G 4MM":  { "id": 393, "option": "4mm" },
"REJUBEAU MESO NEEDLE 34G 4MM":  { "id": 394, "option": "4mm" },
"SUNGSHIM INSULIN SYRINGE  0.5 mL/cc 30G 8MM": { "id": 400, "option": "0.5mL/30G/8mm" },
"SUNGSHIM INSULIN SYRINGE  0.5 mL/cc 31G 8MM": { "id": 400, "option": "0.5mL/31G/8mm" },
"SUNGSHIM INSULIN SYRINGE 1mL/cc  30G 8MM":    { "id": 400, "option": "1mL/30G/8mm" },
"SUNGSHIM INSULIN SYRINGE 1mL/cc 31G 8MM":     { "id": 400, "option": "1mL/31G/8mm" },
"SUNGSHIM NEEDLES 30/13": { "id": 399, "option": "30G/13mm" },
"SUNGSHIM NEEDLES 30/4":  { "id": 399, "option": "30G/4mm" },
"SUNGSHIM Insulin Pen Needle 32G 6MM": { "id": 401, "option": "32G/6mm" }
```

And for REJUBEAU 30G 6mm (unknown), add a wonder entry — extend `wonderProductIds` to accept `{id, option}`: `"wonderOptions": [{ "id": 391, "option": "6mm" }]`.

- [ ] **Step 3: Emit option-aware SQL**

Update the matcher's SQL emit so matched rows produce:

```sql
insert into public.product_stock (product_id, option, stock, stock_unknown)
values (391, '13mm', 5, false)
on conflict (product_id, option) do update set stock = excluded.stock, stock_unknown = false;
```

and wonder rows:

```sql
insert into public.product_stock (product_id, option, stock, wonder, stock_unknown)
values (391, '6mm', 0, true, true)
on conflict (product_id, option) do update set wonder = true, stock_unknown = true;
```

The existing 239 non-option rows emit with `option = ''` and `on conflict (product_id, option)`.

- [ ] **Step 4: Run + verify**

Run: `npx tsx scripts/import-skin-global-stock.ts`
Expected: `needsDecision=0` (all 11 held items now mapped). Confirm the generated SQL has option-aware upserts and no `(product_id)`-only conflict targets.

- [ ] **Step 5: Commit**

```bash
git add scripts/skin-global-manual-map.json scripts/import-skin-global-stock.ts docs/superpowers/plans/stock-import.generated.sql docs/superpowers/plans/stock-import-report.md data/products.json
git commit -m "feat(stock): option-aware import for REJUBEAU/Sungshim; Sungshim notForSale"
```

---

## Task 8: Final verification

**Files:** none

- [ ] **Step 1: Full check** — `npx tsc --noEmit && npm run lint && npm run build` (clean).
- [ ] **Step 2: Manual (after owner runs migration 027 on a test/live DB):**
  - Storefront: no backorder/sold-out labels anywhere; products still orderable; `notForSale` still disables the button.
  - Admin product detail for REJUBEAU 30G: three option editors (4/6/13mm), each own stock/(W)/???/Save; saving one doesn't change another.
  - Admin stock tab: one row per option; "Wonder only" filter works at option level.
  - Place a test order (`ALANTEST`) of a specific option, mark payment verified → only that option's stock decrements; packaging blocked if that option is short.
  - Sungshim products: not purchasable on storefront; per-option stock visible/editable in admin.

---

## Self-Review Notes

- **Spec coverage:** per-option schema+RPC ✓ (Task 2); helpers ✓ (Task 3); deduct/restore/guard per option ✓ (Task 4); customer label removal ✓ (Task 1); admin per-option UI ✓ (Tasks 5–6); import for 11 held items + Sungshim notForSale ✓ (Task 7); ship order documented ✓.
- **Placeholder scan:** none — concrete code/SQL in each step; Task 3 Step 2 uses "compiler enumerates callers" which is a real, deterministic procedure (tsc lists them) plus the explicit file list.
- **Type consistency:** `setProductStock(id, option, n)`, `setProductWonder(id, option, w)`, `getStockFlagsMap(StockKey[])`, `stockKey(id, option)`, `getProductOptionStock(id)`, `deductStockForItems([{product_id,quantity,option}])` used consistently across Tasks 3/4/6. Map value becomes `{id, option}` object in Task 7 with the matcher updated to read it.
- **No-test-harness:** verification via tsc/lint/build + matcher console + manual (no unit runner in repo).
- **Order risk:** Task 1 (label removal) is independent and shippable immediately; Tasks 2–7 depend on migration 027 which the owner runs in Supabase before the option-aware code is deployed.
