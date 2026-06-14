# Per-Option Stock (admin-only) + Remove Customer Stock Labels (Design)

Date: 2026-06-14
Status: Approved (owner confirmed all decisions)

## Background

Products already support purchase-time `options` (e.g. needle length 4/6/13mm) —
the option selector, cart `option`, and `order_items.option` all exist. What's
missing is **stock tracked per option**. Today `product_stock` is keyed by
`product_id` only, so all options of a product share one stock number and one
history.

Separately, the owner decided customers should **not** see stock state at all:
oversell is allowed (every product is orderable), so the "Backorder / 재입고
예정" and "Sold out" labels just advertise being out of stock and discourage
purchase. They will be **removed from the storefront**. Stock becomes a purely
admin/fulfilment concern.

## Decisions (confirmed)

1. **Stock is per `(product_id, option)`.** Optionless products use `option=''`
   and behave exactly as today.
2. **Customer-facing stock labels are removed** — no backorder, no sold-out, no
   stock hints anywhere on the storefront. Customers always order freely.
3. **Per-option stock is admin-only**: tracking, `wonder` (W), `stock_unknown`
   (???), adjust, and history are all per option in the admin.
4. **Packaging/oversell guard stays, per option** (server-side): an order can't
   advance to packaging while an ordered `(product_id, option)` exceeds its
   stock — same mechanism as today, now option-aware.
5. **`notForSale` is unchanged** — it disables purchase on the storefront and is
   NOT a stock state.
6. **Sungshim #399/#400/#401**: define their options, mark `notForSale=true`
   (admin manages option-stock; customers can't buy), import per-option stock.

## Data model

Migration `027` (owner runs in Supabase):
- `product_stock`: add `option text not null default ''`; change primary key
  from `(product_id)` to `(product_id, option)`. Existing rows keep `option=''`.
  `wonder` / `stock_unknown` now apply per `(product_id, option)`.
- `stock_movements`: add `option text not null default ''` for per-option
  history.
- Replace `decrement_stock_for_order(items jsonb)` so each item carries
  `option` and the UPDATE targets the `(product_id, option)` row (insert a
  0-stock row for the option if missing). The `CHECK(stock >= 0)` gate is
  unchanged.

## Components / files

- **`supabase/migrations/027_per_option_stock.sql`** — schema + RPC (owner runs).
- **`lib/products/stock.ts`** — composite-key helpers: read/write keyed by
  `(productId, option)`; `setProductStock(id, option, n)`,
  `setProductWonder(id, option, w)`, `getStockFlagsMap(keys)`; deduct/restore
  use `item.option`.
- **`app/[locale]/checkout/actions.ts`** — pass `option` into the decrement RPC.
- **`app/manzura/orders/actions.ts`** — packaging guard + restore per
  `(product_id, option)` (order_items already carry `option`).
- **Storefront label removal** (no stock shown to customers):
  - `components/catalogue/ProductStockStatus.tsx` — drop backorder/sold-out
    rendering (keep only the `notForSale` case if it lives here).
  - `components/catalogue/ProductCard.tsx` — remove backorder badge.
  - `components/checkout/CartPanel.tsx`, `CartPageClient.tsx` — remove the
    `backorder` label.
  - `components/catalogue/ProductDetailClient.tsx` — remove any backorder text.
  - `lib/useCartStock.ts` — no longer needed for customer display; remove its
    use from customer components (keep server-side stock reads for admin/guard).
  - i18n: leave `cart.backorder` / `outOfStock` keys in place (unused) or remove
    references; do not break key alignment.
- **Admin per-option UI**:
  - `app/manzura/stock/page.tsx` — products with options render one sub-row per
    option (stock, status, (W), ???, history); optionless products unchanged.
  - `app/manzura/products/**` + `StockInput`, `WonderToggle`,
    `ProductStockDetails` — per-option editing/flags/history.
- **Import finish** (`scripts/import-skin-global-stock.ts` + map): the 11 held
  rows become `(product_id, option, qty)`:
  - REJUBEAU 30G → #391: `13mm`=5, `4mm`=8, `6mm`=wonder(???)
  - REJUBEAU 33G → #393: `4mm`=5
  - REJUBEAU 34G → #394: `4mm`=5
  - Sungshim #400 syringes (notForSale): `0.5mL/30G/8mm`=5, `0.5mL/31G/8mm`=5,
    `1mL/30G/8mm`=5, `1mL/31G/8mm`=4
  - Sungshim #399 meso needles (notForSale): `30G/13mm`=4, `30G/4mm`=2
  - Sungshim #401 pen needles (notForSale): `32G/6mm`=2
  - Generated SQL upserts `(product_id, option, stock)`.
- **Catalogue edits (live store)**: add `options` to #399/#400/#401 and set
  `notForSale=true` on those three. Done via the live catalogue (admin or a
  sync/edit script), then `sync-bundled-from-live` to refresh the backup.

## Data flow

- Customer adds product (+option) → cart line keyed by `id::option` (already) →
  order_items store option. No stock shown to customer at any point.
- Admin confirms payment → `decrement_stock_for_order` reduces the
  `(product_id, option)` rows. Packaging blocked if any option is short.
- Admin adjusts an option's stock → clears that option's `stock_unknown`;
  `wonder` (W) persists per the existing rule.

## Out of scope

- Changing `notForSale` semantics.
- Customer-facing stock display (being removed, not redesigned).
- Non-option products' behavior (unchanged besides the label removal).

## Risks / notes

- The PK change on `product_stock` is invasive: the just-shipped wonder/??? code,
  the decrement RPC, and every stock read/write must become option-aware.
  Existing rows migrate to `option=''` (no data loss).
- The 239-row import SQL already generated uses `(product_id)` upserts → those
  become `(product_id, '')` after migration (compatible). The 11 held items are
  added option-aware.
- Ship order: migration 027 in Supabase → deploy code → run option-aware import
  SQL. (Migration 026 + the 239-row import should already be done by then.)
