# Cluster C: Group Display + Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Show group ID ranges on catalogue cards, dual-view search results (groups + individuals), and extend grouping to cleanly-clustered un-grouped products.

**Architecture:** Three independent units, executed in order: extend grouping (script-driven, mutates `data/products.json`), then range display (ProductCard.tsx + `lib/products.ts` helper), then dual-view search (CatalogueClient.tsx + a small BUNDLE badge in globals.css). Each ends in its own commit.

**Tech Stack:** TypeScript 5, React 19, Next.js 16, Tailwind v4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-18-group-display-and-search-design.md` (commit `1429cd9`).

---

## Task 1: Extend grouping (Unit 3 from spec)

**Files:**
- Create: `scripts/extend-grouping.ts`
- Modify: `package.json`, `.gitignore`
- Mutates: `data/products.json`, `data/backups/products-<ts>.json`

### Step 1: Create the script

`scripts/extend-grouping.ts` clusters un-grouped products by `(categoryId, leading_uppercase_prefix)`, assigns groupIds to clusters of size ≥ 2 whose prefix passes the stoplist + length check, derives variantLabels from the trailing tokens, writes back. Backup first. Emit `scripts/extend-grouping-report.txt`.

Stoplist: `PRODUCT`, `MIS`, `NEO`, `DR`, `DK`, `JBP`, `LINE` (and any single-letter prefix).

Heuristic:
- Normalize name: strip parens and lowercase.
- Take first 1-2 uppercase tokens of the ORIGINAL name as `prefix`.
- Cluster within categoryId by exact-prefix-match.
- Discard cluster if prefix in stoplist OR prefix length < 4.
- Discard cluster if size < 2.
- For each remaining cluster: `groupId = slugify(prefix)`. If groupId already in use, append `-<categoryId>`.
- Assign groupId to each member. `variantLabel = name.replace(prefix, '').trim()` (or fallback to the suffix).

### Step 2: Add npm script + gitignore

`package.json` scripts: `"extend-grouping": "tsx scripts/extend-grouping.ts"`
`.gitignore`: `scripts/extend-grouping-report.txt`

### Step 3: Run + refresh group covers

```bash
npm run extend-grouping
npm run derive-groups
```

### Step 4: Verify

- `tsc --noEmit` exit 0, `lint` baseline 70, `build` exit 0.
- `node -e "const d=require('./data/products.json'); const g=new Set(d.products.map(p=>p.groupId).filter(Boolean)); console.log('groupIds:', g.size)"` — target ≥ 40 (up from 33).
- No variantLabel duplicates (re-check via the same script from Cluster A Task 4).

### Step 5: Commit

```bash
git add scripts/extend-grouping.ts package.json .gitignore data/products.json
git commit -m "feat(data): extend grouping to clustered un-grouped products"
```

---

## Task 2: Range display on catalogue cards (Unit 1 from spec)

**Files:**
- Modify: `lib/products.ts` (add `getGroupRange` helper)
- Modify: `components/catalogue/ProductCard.tsx` (use helper)

### Step 1: Add helper in `lib/products.ts`

Append to the existing file (after the existing `getProductVariants` export):

```ts
/** Memoized min/max product id per group. */
const _groupRangeCache: Map<string, { min: number; max: number }> = (() => {
  const m = new Map<string, { min: number; max: number }>();
  for (const p of products) {
    if (!p.groupId) continue;
    const cur = m.get(p.groupId);
    if (!cur) m.set(p.groupId, { min: p.id, max: p.id });
    else m.set(p.groupId, { min: Math.min(cur.min, p.id), max: Math.max(cur.max, p.id) });
  }
  return m;
})();

export function getGroupRange(groupId: string): { min: number; max: number } | null {
  return _groupRangeCache.get(groupId) ?? null;
}
```

### Step 2: Use it in `ProductCard.tsx`

Import `getGroupRange` from `@/lib/products`. Replace the two `#${product.id}` usages with a derived `displayId`:

```tsx
const range = product.groupId && variantCount > 1 ? getGroupRange(product.groupId) : null;
const displayId =
  range && range.max !== range.min
    ? (range.max - range.min > 50 ? `#${range.min}+` : `#${range.min}-${range.max}`)
    : `#${product.id}`;
```

Use `{displayId}` in both list (line 66) and grid (line 136) renders.

### Step 3: Verify

- `tsc`/`lint`/`build` clean.
- Manual (via build): catalogue grid renders. The REGENOVUE group card shows `#3-8`. Solo products like BARBIE SLIM show `#1`. Cross-category group (e.g. BARBIE SLIM at ids 1 + 295) shows `#1+` (because 295-1 > 50).

### Step 4: Commit

```bash
git add lib/products.ts components/catalogue/ProductCard.tsx
git commit -m "feat(ui): show group ID range on catalogue cards (#3-8)"
```

---

## Task 3: Dual-view search (Unit 2 from spec)

**Files:**
- Modify: `app/globals.css` (add `.badge-bundle` style)
- Modify: `components/catalogue/CatalogueClient.tsx` (search-result split + bundle marker)
- Modify: `components/catalogue/ProductCard.tsx` (optional `isBundleHeader` prop or use existing variantCount to drive marker)

### Step 1: Add `.badge-bundle` to `globals.css`

Add inside the existing `@layer components`:

```css
.badge-bundle {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  background-color: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 4px;
}
```

### Step 2: Update `CatalogueClient.tsx` filter pipeline

Find the existing dedupe block (around lines 95-110 — search for `seen.has` or similar). The current pipeline does fuse search → category/sale/new/groupedOnly filters → dedupe-by-groupId. Change so dedupe is conditional on `searchQuery`:

```ts
const filteredProducts = useMemo(() => {
  let result: Product[] = products;

  if (searchQuery.trim()) {
    result = fuse.search(searchQuery).map(r => r.item);
  }
  // ... existing category / sale / new / grouped filters ...

  if (searchQuery.trim()) {
    // Dual view: groups (deduped) then individuals (no dedupe)
    const groupHits: Product[] = [];
    const individualHits: Product[] = [];
    const seenGroup = new Set<string>();
    for (const p of result) {
      if (p.groupId) {
        if (!seenGroup.has(p.groupId)) {
          groupHits.push(p);
          seenGroup.add(p.groupId);
        }
        individualHits.push(p);
      } else {
        individualHits.push(p);
      }
    }
    return [...groupHits, ...individualHits];
  }

  // No query: dedupe by groupId (current behavior)
  const seen = new Set<string>();
  const deduped: Product[] = [];
  for (const p of result) {
    if (p.groupId) {
      if (!seen.has(p.groupId)) {
        deduped.push(p);
        seen.add(p.groupId);
      }
    } else {
      deduped.push(p);
    }
  }
  return deduped;
}, [searchQuery, activeCategory, saleOnly, newOnly, groupedOnly, fuse]);
```

When iterating `paginatedProducts.map(product => <ProductCard ... />)`, pass an extra prop `isBundle={searchQuery.trim() && product.groupId && variantCounts.get(product.groupId)! > 1 && /* this is the first occurrence in this query result */}`. Easier: track which products are group-cards by collecting their indices.

Simplest: when building groupHits, store its product ids in a `Set` and pass `isBundle={bundleIds.has(product.id)}` to ProductCard.

### Step 3: Update `ProductCard.tsx` to render BUNDLE badge

Add an optional prop `isBundle?: boolean`. When `isBundle && isGroup`, render a `<span className="badge-bundle">BUNDLE</span>` alongside the other badges.

### Step 4: Verify

- `tsc`/`lint`/`build` clean.
- Manual: search "neurami" in the catalogue. Expect a BUNDLE-marked Neuramis card first, then individual NEURAMIS LIGHT / DEEP / DEEP+LIDO / VOLUME cards. Pagination still works.

### Step 5: Commit

```bash
git add app/globals.css components/catalogue/CatalogueClient.tsx components/catalogue/ProductCard.tsx
git commit -m "feat(catalogue): dual-view search shows matching groups + individuals"
```

---

## Final verification + push

- `tsc`/`lint`/`build` all green.
- `npm run dev` (you can't, but the build is the smoke test).
- `git push origin main`.
