# Real Stock Import + "Wonder" Classification (Design)

Date: 2026-06-14
Status: Approved (direction + key decisions confirmed by owner)

## Background

The site's current per-product stock numbers (`product_stock.stock`) are all
arbitrary placeholders. The owner's real (offline) stock is in
`Skin Global Stock NoPrice.xlsx` — 298 products, columns **Product** (name) and
**Quantity**. Goal: make the site reflect real stock, clean up the stock
history, and add an admin-only "wonder" marker.

Only `Skin Global Stock NoPrice.xlsx` is in scope. `SG_STOCK_MAY.qty.xlsx` and
`610.xlsx` are NOT used.

## Data reality (from a dry-run match)

Of 298 xlsx rows, naive matching to `data/products.json` (469 products, keyed by
`id`, matched by `name`): 75 exact (case-insensitive) + 39 normalized = **114
auto-matched, 184 unmatched.** Mismatches come from volume/size suffixes
(`ACEPAIN INJ 100mL` vs site `ACEPAIN INJ.`), variants (`BOTULAX 100U/200U/300U`),
and products not on the site. So matching MUST be human-in-the-loop: auto-apply
only confident matches, report the rest for the owner to resolve.

## Phases (in order)

### Phase A — Delete stock history (Part 1)

Delete `inbound` and `adjustment` movements only; keep all order-related
movements (`order`, `cancelled`, `cancel_restock`). This clears the History tab
and per-product details, but does NOT change current `product_stock` numbers
(separate table) and does not touch the Orders/Status tabs.

Delivered as a one-time SQL the owner runs in the Supabase SQL editor:

```sql
delete from public.stock_movements where reason in ('inbound','adjustment');
```

(Optional companion, only if the owner wants tidy batch records too:
`delete from public.inbound_batches ib where not exists
 (select 1 from public.stock_movements m where m.batch_id = ib.id);`)

### Phase B — "Wonder" marker + unknown-stock mechanism (Part 2)

"Wonder" is just an **admin-only label** the owner applies **manually** to
products (NOT auto-assigned). It marks products whose real stock is unknown.

**Schema** — extend `product_stock` (owner runs migration SQL in Supabase):
```sql
alter table public.product_stock
  add column if not exists wonder        boolean not null default false,
  add column if not exists stock_unknown boolean not null default false;
```
A product with no row = stock 0, not wonder, not unknown (defaults). Flagging
wonder upserts a row with `wonder=true, stock_unknown=true`.

**Behavior**
- `stock_unknown=true` → the stock value renders as **"???"**; the system treats
  it as **0** everywhere stock is read. Because it is 0, the **existing
  packaging/oversell guard** (admin order detail + `app/manzura/orders/actions.ts`)
  applies unchanged: a customer can still place the order (oversell allows 0 =
  backorder), but once payment is verified the order **cannot be advanced to
  packaging** — it shows the usual "short by N / 재입고 필요" shortfall until the
  admin fills in real stock. Admin product/stock views show a **warning** to
  adjust it. No new blocking logic is added; "???" simply reuses the 0-stock path.
- Adjusting the stock to a real number → **"???" disappears, the number shows**,
  and `stock_unknown` becomes false while **`wonder` (the (W) mark) stays**.
- A purple **(W)** icon (hover tooltip "wonder") shows next to the product name in
  `admin/products` (list + detail) and `admin/stock` (stock tab). Reuses the same
  small-inline-mark pattern as `EmailVerifiedMark`.
- The stock tab gains a **"Wonder only"** filter next to the Sort control.
- A toggle in the admin product view sets/clears `wonder`. Setting it also sets
  `stock_unknown=true`; an explicit stock **adjust** to a number sets
  `stock_unknown=false` while **keeping** `wonder=true` (the (W) label persists).
- Admin-only — never shown to customers; customer-facing stock keeps reading the
  numeric value (0 when unknown).

### Phase C — Import real stock + report loop (Part 3)

A local matcher script (Node, reads the xlsx + `data/products.json` — no DB
access needed) produces two outputs:

1. **Confident matches** (exact + normalized) → SQL `upsert`s into
   `product_stock` setting `stock = <xlsx quantity>, stock_unknown = false` for
   each matched `product_id`. Owner runs this SQL in Supabase.
2. **Report** (`docs/.../stock-import-report.md`) listing every unmatched/ambiguous
   xlsx item with its best-guess site candidates (`id` + name) so the owner can
   confirm "this xlsx item = product #N" or "not on site".

Loop: owner resolves entries → I add the confirmed mappings → regenerate the
import SQL + shrink the report → repeat until the owner says "done".

**No automatic wonder assignment.** After matching settles, the owner manually
flags whichever leftover products they want as wonder (Phase B toggle), which
sets them to ??? stock.

Matching tiers (auto-apply only 1–2; tier 3 = report candidates):
1. Exact, case-insensitive, trimmed.
2. Normalized: uppercase, strip `[...]`/`(...)`, strip non-alphanumerics.
3. Fuzzy core: also strip volume/unit tokens (mL, g, mg, IU, U, PCS, "X N") and
   match on the leading product/brand core → produce candidate suggestions
   (never auto-applied; multiple site variants sharing a core are listed for the
   owner to pick).

## Components / files (anticipated)

- `supabase/migrations/0XX_wonder_and_unknown_stock.sql` — Phase B columns (owner runs).
- `scripts/import-skin-global-stock.ts` — Phase C matcher → emits import SQL + report.
- `lib/products/stock.ts` — extend read helpers to surface `wonder`/`stock_unknown`.
- `components/admin/WonderMark.tsx` — purple (W) inline marker (mirrors EmailVerifiedMark).
- `app/manzura/products/**` — (W) icon next to name + wonder toggle + ??? + warning.
- `app/manzura/stock/page.tsx` + `actions.ts` — (W) icon, "Wonder only" filter, ??? display, adjust clears unknown.

## Out of scope

- Touching Orders/Status tabs or order-derived stock movements.
- Customer-facing changes (wonder/??? are admin-only).
- The other xlsx files. Prices (the file is "NoPrice").

## Risks / notes

- Phase A is destructive but limited to inbound/adjustment history; current stock
  numbers are unaffected. Owner runs it knowingly in Supabase.
- The import SQL overwrites placeholder stock with real numbers — intended.
- Matching is iterative; expect ~50–100+ manual confirmations given the 184
  initial misses. The report is the owner's worklist.
- A+C are the operational priority (go live with real stock); B (wonder) is an
  admin nicety layered on the same table.
