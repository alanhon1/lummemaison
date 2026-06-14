# Real Stock Import + "Wonder" Classification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site's placeholder stock with the owner's real stock from `Skin Global Stock NoPrice.xlsx` (name-matched, human-in-the-loop), clean the stock history, and add an admin-only manual "wonder" marker with an "unknown (???)" stock state.

**Architecture:** Phase A is a one-time SQL the owner runs. Phase B extends `product_stock` with two booleans (`wonder`, `stock_unknown`) and surfaces them in the admin product + stock screens via a small `WonderMark` and a "???" render path that reuses the existing 0-stock/packaging guard. Phase C is a local Node matcher that emits import SQL for confident matches plus a markdown report of the rest for the owner to resolve, then regenerate.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19, Supabase (service client), `xlsx` + `tsx` for the matcher. No unit-test runner in this repo — verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the matcher's deterministic console output. DB migrations are run by the owner in the Supabase SQL editor (not auto-applied).

**Spec:** `docs/superpowers/specs/2026-06-14-real-stock-import-and-wonder-classification-design.md`

---

## File Structure

- **Create** `supabase/manual/2026-06-14-delete-inbound-adjustment-history.sql` — Phase A one-time DELETE (owner runs).
- **Create** `supabase/migrations/026_wonder_and_unknown_stock.sql` — Phase B columns (owner runs).
- **Modify** `lib/products/stock.ts` — `getStockFlagsMap`, `setProductStock` clears `stock_unknown`, `setProductWonder`.
- **Create** `components/admin/WonderMark.tsx` — purple (W) inline marker.
- **Modify** `app/manzura/products/actions.ts` — `toggleWonderAction`.
- **Create** `components/admin/WonderToggle.tsx` — client toggle used on product detail.
- **Modify** `app/manzura/products/[id]/page.tsx` — render WonderToggle + (W) using flags.
- **Modify** `components/admin/StockInput.tsx` — show "???" + warning when unknown.
- **Modify** `components/admin/ProductsClient.tsx` + `app/manzura/products/page.tsx` — pass + render wonder/unknown in the list.
- **Modify** `app/manzura/stock/page.tsx` — (W) icon, "???" render, "Wonder only" filter.
- **Create** `scripts/import-skin-global-stock.ts` — Phase C matcher → emits import SQL + report.
- **Create** `scripts/skin-global-manual-map.json` — owner-confirmed name→id mappings (starts `{}`).

---

## Phase A — Delete stock history

### Task 1: One-time delete SQL

**Files:**
- Create: `supabase/manual/2026-06-14-delete-inbound-adjustment-history.sql`

- [ ] **Step 1: Write the SQL file**

```sql
-- One-time cleanup (run in Supabase SQL editor). Deletes inbound + adjustment
-- stock movements only. Keeps order-related history (order/cancelled/
-- cancel_restock). Does NOT change product_stock numbers or the Orders/Status
-- tabs. See docs/superpowers/specs/2026-06-14-real-stock-import-and-wonder-classification-design.md
delete from public.stock_movements
where reason in ('inbound', 'adjustment');

-- Optional: drop inbound batches that no longer have any movements.
delete from public.inbound_batches ib
where not exists (
  select 1 from public.stock_movements m where m.batch_id = ib.id
);
```

- [ ] **Step 2: Commit (the owner runs it manually in Supabase)**

```bash
git add supabase/manual/2026-06-14-delete-inbound-adjustment-history.sql
git commit -m "chore(stock): SQL to delete inbound+adjustment history (Phase A)"
```

---

## Phase B — Wonder marker + unknown-stock mechanism

### Task 2: Migration — add `wonder` and `stock_unknown`

**Files:**
- Create: `supabase/migrations/026_wonder_and_unknown_stock.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Admin-only product flags layered onto the existing per-product stock row.
--   wonder        : a manual admin label (purple "W"); never shown to customers.
--   stock_unknown : real stock not yet known → UI shows "???" and treats it as 0
--                   (reusing the existing 0-stock/packaging guard). Cleared when
--                   an admin sets a real number.
alter table public.product_stock
  add column if not exists wonder        boolean not null default false,
  add column if not exists stock_unknown boolean not null default false;
```

- [ ] **Step 2: Commit (owner runs it in Supabase before the UI ships)**

```bash
git add supabase/migrations/026_wonder_and_unknown_stock.sql
git commit -m "feat(stock): migration for wonder + stock_unknown flags (Phase B)"
```

### Task 3: Stock helpers — flags + clearing unknown

**Files:**
- Modify: `lib/products/stock.ts`

- [ ] **Step 1: Add a flags reader and a wonder setter; clear `stock_unknown` on numeric set**

Add to `lib/products/stock.ts` (after `getProductStock`, keep existing functions):

```ts
export interface StockFlags {
  stock: number;
  wonder: boolean;
  stockUnknown: boolean;
}

// Reads stock + admin flags for the given ids. Missing rows default to
// { stock: 0, wonder: false, stockUnknown: false }.
export async function getStockFlagsMap(productIds: number[]): Promise<Record<number, StockFlags>> {
  const out: Record<number, StockFlags> = {};
  for (const id of productIds) out[id] = { stock: 0, wonder: false, stockUnknown: false };
  if (productIds.length === 0) return out;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('product_stock')
    .select('product_id, stock, wonder, stock_unknown')
    .in('product_id', productIds);
  if (error) {
    console.error('[stock] getStockFlagsMap failed', error.message);
    return out;
  }
  for (const r of data ?? []) {
    out[r.product_id as number] = {
      stock: (r.stock as number) ?? 0,
      wonder: Boolean(r.wonder),
      stockUnknown: Boolean(r.stock_unknown),
    };
  }
  return out;
}
```

- [ ] **Step 2: Make `setProductStock` clear `stock_unknown` (admin set a real number)**

Replace the existing `setProductStock` body's upsert in `lib/products/stock.ts`:

```ts
export async function setProductStock(productId: number, stock: number): Promise<{ ok: boolean; error?: string }> {
  const clamped = Math.max(0, Math.floor(stock));
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('product_stock')
    .upsert(
      { product_id: productId, stock: clamped, stock_unknown: false },
      { onConflict: 'product_id' },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 3: Add `setProductWonder`**

Append to `lib/products/stock.ts`:

```ts
// Toggles the admin-only "wonder" flag. Enabling it also marks stock unknown
// (the product's real stock isn't known yet → shows "???"). Disabling clears
// both the flag and the unknown state.
export async function setProductWonder(productId: number, wonder: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceClient();
  const row = wonder
    ? { product_id: productId, wonder: true, stock_unknown: true, stock: 0 }
    : { product_id: productId, wonder: false, stock_unknown: false };
  const { error } = await supabase
    .from('product_stock')
    .upsert(row, { onConflict: 'product_id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/products/stock.ts
git commit -m "feat(stock): flags reader, wonder setter, clear unknown on set"
```

### Task 4: WonderMark component

**Files:**
- Create: `components/admin/WonderMark.tsx`

- [ ] **Step 1: Create the marker (mirrors EmailVerifiedMark)**

```tsx
'use client';

// Small purple "W" shown next to a product name when it's flagged wonder
// (admin-only). Hover scales it slightly; tooltip reads "wonder".
export default function WonderMark() {
  return (
    <span
      title="wonder"
      aria-label="wonder"
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-purple-600 text-white align-middle shrink-0 cursor-default text-[10px] font-bold leading-none transition-transform duration-150 hover:scale-125 hover:bg-purple-700"
    >
      W
    </span>
  );
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add components/admin/WonderMark.tsx
git commit -m "feat(admin): WonderMark (W) indicator"
```

### Task 5: `toggleWonderAction`

**Files:**
- Modify: `app/manzura/products/actions.ts`

- [ ] **Step 1: Add the server action**

Add the import at the top of `app/manzura/products/actions.ts` (extend the existing line):

```ts
import { getProductStock, setProductStock, setProductWonder } from '@/lib/products/stock';
```

Append the action:

```ts
export async function toggleWonderAction(
  productId: number,
  wonder: boolean,
): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, error: 'Invalid product id.' };
  }
  return setProductWonder(productId, wonder);
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add app/manzura/products/actions.ts
git commit -m "feat(admin): toggleWonderAction"
```

### Task 6: Product detail — wonder toggle + (W) + "???" in StockInput

**Files:**
- Create: `components/admin/WonderToggle.tsx`
- Modify: `components/admin/StockInput.tsx`
- Modify: `app/manzura/products/[id]/page.tsx`

- [ ] **Step 1: Create the toggle**

`components/admin/WonderToggle.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toggleWonderAction } from '@/app/manzura/products/actions';
import WonderMark from './WonderMark';

export default function WonderToggle({
  productId,
  initialWonder,
}: {
  productId: number;
  initialWonder: boolean;
}) {
  const [wonder, setWonder] = useState(initialWonder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    const next = !wonder;
    const res = await toggleWonderAction(productId, next);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Failed.'); return; }
    setWonder(next);
  }

  return (
    <div className="flex items-center gap-2">
      {wonder && <WonderMark />}
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className="text-xs border border-bone px-3 py-1.5 rounded text-mist hover:text-charcoal transition-colors disabled:opacity-50 inline-flex items-center gap-2"
      >
        {saving && <Loader2 size={12} className="animate-spin" />}
        {wonder ? 'Unmark wonder' : 'Mark as wonder'}
      </button>
      {wonder && (
        <span className="text-[10px] text-purple-700">Stock shows ??? until you set a number.</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Show "???" + warning in StockInput when unknown**

In `components/admin/StockInput.tsx`, extend `Props` and the render. Change the interface:

```ts
interface Props {
  productId: number;
  initialStock: number;
  initialUnknown?: boolean;
}
```

Change the component signature line `export default function StockInput({ productId, initialStock }: Props) {` to:

```ts
export default function StockInput({ productId, initialStock, initialUnknown = false }: Props) {
```

After `const dirty = parsed !== initialStock;` add:

```ts
  // Once the admin types and saves a number, the row is no longer "unknown".
  // We only show the ??? warning until that first save in this session.
  const showUnknown = initialUnknown && savedAt === null;
```

Then, inside the `<div className="flex items-center gap-3">` block, immediately after the `<button … Save stock>` button (before the `{parsed === 0 && …}` line), add:

```tsx
          {showUnknown && (
            <span className="text-[10px] uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded">
              ??? — set the real stock (counts as 0 until you do)
            </span>
          )}
```

- [ ] **Step 3: Wire flags into the product detail page**

In `app/manzura/products/[id]/page.tsx`, replace the stock fetch + render. Change:

```tsx
import { getProductStock } from '@/lib/products/stock';
```
to:
```tsx
import { getStockFlagsMap } from '@/lib/products/stock';
import WonderToggle from '@/components/admin/WonderToggle';
```

Replace `const initialStock = await getProductStock(numericId);` with:

```tsx
  const flags = (await getStockFlagsMap([numericId]))[numericId];
```

Replace the `<StockInput … />` block:

```tsx
      <div className="max-w-5xl mx-auto px-6 pt-6 space-y-3">
        <StockInput productId={product.id} initialStock={flags.stock} initialUnknown={flags.stockUnknown} />
        <WonderToggle productId={product.id} initialWonder={flags.wonder} />
      </div>
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint components/admin/WonderToggle.tsx components/admin/StockInput.tsx "app/manzura/products/[id]/page.tsx"`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add components/admin/WonderToggle.tsx components/admin/StockInput.tsx "app/manzura/products/[id]/page.tsx"
git commit -m "feat(admin): wonder toggle + ??? unknown-stock on product detail"
```

### Task 7: Products list — (W) icon + "???" cell

**Files:**
- Modify: `app/manzura/products/page.tsx`
- Modify: `components/admin/ProductsClient.tsx`

- [ ] **Step 1: Pass flag maps from the products page**

In `app/manzura/products/page.tsx`, find where `stockMap` is built (a `Record<number, number>` passed to `ProductsClient`) and additionally build wonder/unknown sets. Add near that code:

```tsx
  // Flags for the (W) marker + ??? cell. Reuse the same product id list already
  // used to build stockMap.
  const flagsMap = await getStockFlagsMap(allProductIds);
  const wonderIds = Object.entries(flagsMap).filter(([, f]) => f.wonder).map(([id]) => Number(id));
  const unknownIds = Object.entries(flagsMap).filter(([, f]) => f.stockUnknown).map(([id]) => Number(id));
```

(Use the existing variable that holds all product ids in this file in place of `allProductIds`; if stock is fetched differently, derive the id list from the products array: `const allProductIds = products.map(p => p.id);`. Add the import `import { getStockFlagsMap } from '@/lib/products/stock';`.)

Pass them to the client:

```tsx
        wonderIds={wonderIds}
        unknownIds={unknownIds}
```

- [ ] **Step 2: Render them in ProductsClient**

In `components/admin/ProductsClient.tsx`:

- Add to `Props`:
```ts
  wonderIds?: number[];
  unknownIds?: number[];
```
- In the component body, build sets once:
```ts
  const wonderSet = useMemo(() => new Set(wonderIds ?? []), [wonderIds]);
  const unknownSet = useMemo(() => new Set(unknownIds ?? []), [unknownIds]);
```
- Import the marker at the top: `import WonderMark from './WonderMark';`
- Where each product **name** is rendered in the row/card, wrap it so the marker follows the name when `wonderSet.has(p.id)`:
```tsx
  <span className="inline-flex items-center gap-1">
    {p.name}
    {wonderSet.has(p.id) && <WonderMark />}
  </span>
```
- In `InlineStockCell` usage, when `unknownSet.has(p.id)` render `???` instead of the number. At the cell render site, guard:
```tsx
  {unknownSet.has(p.id)
    ? <span className="text-purple-700 font-semibold" title="Unknown — set the real stock">???</span>
    : <InlineStockCell productId={p.id} initial={stockMap[p.id] ?? 0} onChange={/* existing */} />}
```
(Keep the existing `InlineStockCell` props exactly as they are today; only add the `unknownSet` branch around it.)

- [ ] **Step 3: Type-check + lint + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/manzura/products/page.tsx components/admin/ProductsClient.tsx
git commit -m "feat(admin): (W) marker + ??? cell in products list"
```

### Task 8: Stock tab — (W), "???", and "Wonder only" filter

**Files:**
- Modify: `app/manzura/stock/page.tsx`

- [ ] **Step 1: Read flags and a `wonderOnly` query param in the stock tab**

In `app/manzura/stock/page.tsx`, inside `if (tab === 'stock') { … }` (currently builds `rows`/`allRows` from `product_stock` select of `product_id, stock`), change the select to include the flags and read the filter param. Replace:

```tsx
    const { data: stockRows } = await supabase
      .from('product_stock')
      .select('product_id, stock');

    const rows = (stockRows ?? []) as Array<{ product_id: number; stock: number }>;

    const allRows = allProducts.map(p => ({
      id: p.id,
      name: p.name as string,
      stock: rows.find(r => r.product_id === p.id)?.stock ?? 0,
    })).sort((a, b) => {
```

with:

```tsx
    const wonderOnly = sp.wonderOnly === '1';
    const { data: stockRows } = await supabase
      .from('product_stock')
      .select('product_id, stock, wonder, stock_unknown');

    const rows = (stockRows ?? []) as Array<{ product_id: number; stock: number; wonder: boolean; stock_unknown: boolean }>;
    const rowFor = (id: number) => rows.find(r => r.product_id === id);

    let allRows = allProducts.map(p => ({
      id: p.id,
      name: p.name as string,
      stock: rowFor(p.id)?.stock ?? 0,
      wonder: Boolean(rowFor(p.id)?.wonder),
      unknown: Boolean(rowFor(p.id)?.stock_unknown),
    }));
    if (wonderOnly) allRows = allRows.filter(r => r.wonder);
    allRows = allRows.sort((a, b) => {
```

Add `wonderOnly?: string;` to the `searchParams` type near the other params (`tab`, `sort`, …). Add the import at the top of the file: `import WonderMark from '@/components/admin/WonderMark';`.

- [ ] **Step 2: Add the "Wonder only" toggle next to Sort**

In the Sort controls `<form>` (the block with the `Sort` label + select + Apply button), add a link toggle after the Apply button:

```tsx
          <a
            href={`/manzura/stock?tab=stock${wonderOnly ? '' : '&wonderOnly=1'}&sort=${sort}`}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              wonderOnly
                ? 'bg-purple-600 text-white border-purple-600'
                : 'border-bone text-mist hover:text-charcoal'
            }`}
          >
            {wonderOnly ? 'Wonder ✓' : 'Wonder only'}
          </a>
```

- [ ] **Step 3: Render (W) + "???" in the table rows**

In the `allRows.map(r => { … })` row body: render the (W) next to the name, and "???" instead of the number when unknown. Replace the name cell and the stock cell:

```tsx
                    <td className="px-4 py-2.5 text-charcoal text-sm">
                      <span className="inline-flex items-center gap-1">
                        {r.name}
                        {r.wonder && <WonderMark />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-charcoal">
                      {r.unknown ? <span className="text-purple-700" title="Unknown — set the real stock">???</span> : r.stock}
                    </td>
```

(Leave the Status column as-is; an unknown row has stock 0 so it already shows "Sold out", which is acceptable — it cannot be packed until adjusted.)

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/manzura/stock/page.tsx
git commit -m "feat(admin): stock tab (W) marker, ??? cell, Wonder-only filter"
```

---

## Phase C — Import real stock + report loop

### Task 9: Matcher script

**Files:**
- Create: `scripts/skin-global-manual-map.json`
- Create: `scripts/import-skin-global-stock.ts`

- [ ] **Step 1: Seed the manual-map file (owner-confirmed overrides)**

`scripts/skin-global-manual-map.json`:

```json
{
  "_comment": "Owner-confirmed mappings: xlsx product name -> site product id. Add entries as the owner confirms them. Use 0 to mark 'not on site (skip)'.",
  "mappings": {}
}
```

- [ ] **Step 2: Write the matcher**

`scripts/import-skin-global-stock.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, 'Skin Global Stock NoPrice.xlsx');
const PRODUCTS_PATH = path.join(ROOT, 'data', 'products.json');
const MAP_PATH = path.join(ROOT, 'scripts', 'skin-global-manual-map.json');
const SQL_OUT = path.join(ROOT, 'docs', 'superpowers', 'plans', 'stock-import.generated.sql');
const REPORT_OUT = path.join(ROOT, 'docs', 'superpowers', 'plans', 'stock-import-report.md');

interface Prod { id: number; name: string }

function norm(s: string): string {
  return String(s).toUpperCase().replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[^A-Z0-9]/g, '');
}
// Fuzzy "core": also drop volume/unit/quantity tokens so variants collapse.
function core(s: string): string {
  return String(s).toUpperCase()
    .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(ML|L|G|MG|KG|IU|U|PCS|BOX|AMP|VIAL|MASKS?|UNITS?)\b/g, ' ')
    .replace(/\bX\s*\d+\b/g, ' ')
    .replace(/[^A-Z0-9]/g, '');
}

const wb = xlsx.readFile(XLSX_PATH);
const rawRows = xlsx.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
const xlsxItems = rawRows.slice(2)
  .filter(r => String(r[0]).trim())
  .map(r => ({ name: String(r[0]).trim(), qty: Math.max(0, Math.floor(Number(r[1]) || 0)) }));

const prodRaw = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
const products: Prod[] = (Array.isArray(prodRaw) ? prodRaw : prodRaw.products || Object.values(prodRaw))
  .map((p: { id: number; name: string }) => ({ id: p.id, name: String(p.name) }));

const manual = JSON.parse(readFileSync(MAP_PATH, 'utf8')).mappings as Record<string, number>;

const byExact = new Map<string, Prod>();
const byNorm = new Map<string, Prod[]>();
const byCore = new Map<string, Prod[]>();
for (const p of products) {
  byExact.set(p.name.trim().toUpperCase(), p);
  (byNorm.get(norm(p.name)) ?? byNorm.set(norm(p.name), []).get(norm(p.name))!).push(p);
  (byCore.get(core(p.name)) ?? byCore.set(core(p.name), []).get(core(p.name))!).push(p);
}

const matched: { name: string; qty: number; id: number; how: string }[] = [];
const skipped: string[] = [];
const report: { name: string; qty: number; candidates: Prod[] }[] = [];

for (const it of xlsxItems) {
  if (Object.prototype.hasOwnProperty.call(manual, it.name)) {
    const id = manual[it.name];
    if (id === 0) { skipped.push(it.name); continue; }
    matched.push({ name: it.name, qty: it.qty, id, how: 'manual' });
    continue;
  }
  const exact = byExact.get(it.name.toUpperCase());
  if (exact) { matched.push({ name: it.name, qty: it.qty, id: exact.id, how: 'exact' }); continue; }
  const n = byNorm.get(norm(it.name));
  if (n && n.length === 1) { matched.push({ name: it.name, qty: it.qty, id: n[0].id, how: 'normalized' }); continue; }
  // ambiguous or unmatched → report with core candidates
  const cands = (byCore.get(core(it.name)) ?? n ?? []).slice(0, 6);
  report.push({ name: it.name, qty: it.qty, candidates: cands });
}

// Emit import SQL (confident + manual).
const sql = [
  '-- Generated by scripts/import-skin-global-stock.ts. Run in Supabase SQL editor.',
  '-- Sets real stock from Skin Global Stock NoPrice.xlsx for matched products.',
  ...matched.map(m =>
    `insert into public.product_stock (product_id, stock, stock_unknown) values (${m.id}, ${m.qty}, false) ` +
    `on conflict (product_id) do update set stock = excluded.stock, stock_unknown = false; -- ${m.name} [${m.how}]`),
  '',
].join('\n');
writeFileSync(SQL_OUT, sql);

// Emit the owner report.
const rep = [
  `# Stock Import Report — ${xlsxItems.length} xlsx products`,
  '',
  `- Matched (will be in the SQL): **${matched.length}**`,
  `- Skipped (manual map = 0, not on site): **${skipped.length}**`,
  `- Needs your decision: **${report.length}**`,
  '',
  '## Needs your decision',
  'For each, reply with the site product id (or "skip"). Best-guess candidates shown.',
  '',
  ...report.map(r => {
    const cands = r.candidates.length
      ? r.candidates.map(c => `#${c.id} ${c.name}`).join(' · ')
      : '(no candidates found)';
    return `- **${r.name}** (qty ${r.qty})\n  - candidates: ${cands}`;
  }),
  '',
].join('\n');
writeFileSync(REPORT_OUT, rep);

console.log(`xlsx=${xlsxItems.length} matched=${matched.length} skipped=${skipped.length} needsDecision=${report.length}`);
console.log(`SQL  -> ${path.relative(ROOT, SQL_OUT)}`);
console.log(`report -> ${path.relative(ROOT, REPORT_OUT)}`);
```

- [ ] **Step 3: Run it**

Run: `npx tsx scripts/import-skin-global-stock.ts`
Expected: prints a summary line like `xlsx=298 matched=NN skipped=0 needsDecision=MM` and writes the two output files. Confirm `docs/superpowers/plans/stock-import.generated.sql` and `stock-import-report.md` exist.

- [ ] **Step 4: Commit the script + first outputs**

```bash
git add scripts/import-skin-global-stock.ts scripts/skin-global-manual-map.json docs/superpowers/plans/stock-import.generated.sql docs/superpowers/plans/stock-import-report.md
git commit -m "feat(stock): Skin Global matcher → import SQL + report (Phase C)"
```

### Task 10: Report loop with the owner

**Files:**
- Modify: `scripts/skin-global-manual-map.json` (iteratively)
- Regenerate: the two output files

- [ ] **Step 1: Hand the report to the owner**

Show `docs/superpowers/plans/stock-import-report.md` (the "Needs your decision" list). Ask the owner to resolve entries — for each xlsx name, the matching site product id, or "skip" (not on site).

- [ ] **Step 2: Record confirmed mappings**

Add each confirmed mapping to `scripts/skin-global-manual-map.json` under `mappings` (xlsx name → id, or `0` to skip).

- [ ] **Step 3: Regenerate and re-show**

Run: `npx tsx scripts/import-skin-global-stock.ts`
Expected: `matched` rises, `needsDecision` shrinks. Repeat steps 1–3 until the owner says "done" (or the remaining entries are all genuinely not-on-site).

- [ ] **Step 4: Owner runs the final SQL**

Tell the owner to run `docs/superpowers/plans/stock-import.generated.sql` in the Supabase SQL editor. This sets real stock for all matched products. (No automatic wonder assignment — the owner marks wonder manually via the product detail toggle from Task 6.)

- [ ] **Step 5: Commit the final map + outputs**

```bash
git add scripts/skin-global-manual-map.json docs/superpowers/plans/stock-import.generated.sql docs/superpowers/plans/stock-import-report.md
git commit -m "chore(stock): finalize Skin Global stock mappings"
```

---

## Task 11: Final verification

**Files:** none

- [ ] **Step 1: Full type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 2: Manual admin checks (dev server)**

Run `npm run dev`, then in the admin:
- Product detail: "Mark as wonder" → (W) appears, stock shows the ??? warning; set a number + Save → ??? warning clears, (W) stays.
- Products list: a wonder product shows (W) next to its name and ??? in its stock cell.
- Stock tab: (W) next to wonder names, ??? in their stock column, "Wonder only" filter shows just those.
- Place a test order (postal `ALANTEST`) containing a ??? product, mark payment verified in admin, confirm the order **cannot advance to packaging** (existing shortfall guard) until stock is set.

---

## Self-Review Notes

- **Spec coverage:** Phase A delete SQL ✓ (Task 1); Phase B columns ✓ (Task 2), flags/clear-unknown/setWonder ✓ (Task 3), (W) marker ✓ (Tasks 4/6/7/8), ??? + warning ✓ (Tasks 6/7/8), reuses existing packaging guard ✓ (Task 11 Step 2, no new blocking logic), Wonder-only filter ✓ (Task 8), manual-only wonder ✓ (no auto-flag anywhere); Phase C matcher + SQL + report + loop ✓ (Tasks 9/10), confident-only auto-apply with tiers ✓, owner runs SQL ✓.
- **Placeholder scan:** none — every code step has concrete code; the one "use the existing all-ids variable" note in Task 7 includes the exact fallback (`products.map(p => p.id)`).
- **Type consistency:** `getStockFlagsMap` returns `Record<number, StockFlags>` with `{stock, wonder, stockUnknown}`, used consistently in Tasks 6/7. `setProductWonder`/`toggleWonderAction` signatures match. `WonderMark` takes no props everywhere it's used. Stock-tab row objects gain `wonder`/`unknown` and are referenced under those names.
- **No-test-harness note:** repo has no unit runner, so tasks verify via `tsc`/`lint`/`build`/manual + the matcher's deterministic console counts, rather than TDD red/green.
