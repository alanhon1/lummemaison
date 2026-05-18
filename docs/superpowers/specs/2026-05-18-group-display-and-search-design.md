# Spec: Cluster C — Group Range Display, Dual-View Search, Extended Grouping

**Date**: 2026-05-18
**Status**: Approved (autonomous mode — Cluster C of 5)

## Background

After Cluster A, the catalogue dedupes 33 product groups into single cards but displays only one variant's ID (`#3` for the REGENOVUE group spanning ids 3-8). The user wants the displayed identifier to reflect the *range* of variant IDs in the group. They also want catalogue search to surface both the matching group card AND the matching individual variant cards (currently search only shows the group card per dedupe). Finally, a number of name-clustered products that share a clear prefix (e.g. YOUTHFILL FINE / DEEP / SHAPE) are not currently grouped — extend the grouping.

## Goals

1. **Range display**: on catalogue product cards (both grid and list), grouped products show `#{minId}-{maxId}` instead of just `#{product.id}`. Solo products (no `groupId`) keep `#{id}`.
2. **Dual-view search**: when the catalogue's search input has a query, the filtered result is *both* matching groups (rendered once each, as today) *and* matching individuals. Groups appear first in the results, visually marked as bundles; individuals appear after.
3. **Extended grouping**: identify name-clustered products that aren't yet grouped, and add `groupId` to them. Examples: YOUTHFILL, ULTRAFILL, BONETTA, VOM, ELASTY, CELOSOME, TESORO, SOSUM (already partially grouped), CHAEUM PREMIUM, REVOLAX, DERMALAX. Conservative — only group when 2+ products share a clean uppercase brand prefix.
4. **Click-through behavior unchanged**: clicking an individual variant card in the dual-view results navigates to that specific variant's product detail page. The page already shows the variant selector and crossfade gallery from prior clusters.

## Non-goals

- Internal product ID renumbering (user explicitly chose to keep IDs).
- PDF parsing for an alternate numbering.
- Display category-relative numbering.
- New routing or new pages.
- Search algorithm changes — keep Fuse.js with current keys/weights.

## Current state (verified 2026-05-18)

- `data/products.json` has 438 products, 33 groups (33 unique `groupId` values).
- `components/catalogue/ProductCard.tsx` shows `#${product.id}` on both grid (line 136) and list (line 66) layouts.
- `components/catalogue/CatalogueClient.tsx` deduplicates grouped products into the first-seen variant. The dedupe happens after filter pipeline in the catalogue (around lines 95-110 — verify in implementation).
- `scripts/derive-group-display.ts` already handles `groupName` / `groupImage` derivation; we'll add a script to *create* new groupIds for cleanly-clustered un-grouped products.

## Design

### Unit 1 — Range display in `ProductCard.tsx`

Compute the displayed range as a derived prop or inline:

```tsx
const groupRange = isGroup ? deriveRange(product, allGroupMembers) : null;
const displayId = groupRange ? `#${groupRange.min}-${groupRange.max}` : `#${product.id}`;
```

`allGroupMembers` is passed in from the parent. To avoid passing every group's members through CatalogueClient, the simplest approach is to compute min/max id per group ONCE in `lib/products.ts` (a memoized helper or a static map at module load) and expose `getGroupRange(groupId): { min, max } | null`. ProductCard calls `getGroupRange(product.groupId)` when rendering.

Display format: `#3-8` (no spaces around the dash). When min === max (single-variant group), display as `#N` — though this shouldn't happen for a real group.

### Unit 2 — Dual-view search in `CatalogueClient.tsx`

Current dedupe behavior: every product passes through filter pipeline, then `seen.has(groupId)` dedupe keeps only the first occurrence per group.

New behavior when `searchQuery.trim()` is non-empty:
- Filter pipeline runs as today, producing `result: Product[]`.
- Split into two arrays:
  - `groupHits: Product[]` — first-seen variant per matching group (one per group).
  - `individualHits: Product[]` — all matching variants of groups + all matching ungrouped products.
- Render: `groupHits` first (each `ProductCard` rendered with a small visual marker — TBD: a subtle "Bundle" pill or just a `border-l-2 border-gold` accent on the card). Then `individualHits` after, no marker.
- For a grouped product that appears in `individualHits`, the card shows the *variant's* name + ID (not the group display name), so users see e.g. "REGENOVUE FINE PLUS (CE) #6" as a separate card distinct from the group's "Regenovue Sub-Q #3-8" card.

When `searchQuery` is empty, keep current dedupe behavior (one card per group, no individuals).

Bundle marker decision: use a small "BUNDLE" label in the badge column (alongside NEW / SALE / BESTSELLER), styled the same way (`badge-best`-like, gold-bordered). This requires a small CSS class addition in `globals.css`.

### Unit 3 — Extended grouping via new script

Create `scripts/extend-grouping.ts`:

1. Read `data/products.json`.
2. For products in the same `categoryId` with no `groupId`, compute a name prefix (first 1-2 uppercase tokens).
3. Cluster products by `(categoryId, prefix)`. Filter to clusters of size ≥ 2.
4. Filter out clusters where the prefix is too generic (single token of length < 4, or in a stoplist like "PRODUCT", "MISFILL", or category brand names that are too broad — to be tuned during impl).
5. For each eligible cluster, generate a `groupId` from the prefix (slugified, e.g. "YOUTHFILL" → "youthfill").
6. Assign `groupId` to all cluster members (skip products that already have a groupId).
7. Derive a sensible `variantLabel` from each member's suffix (the tokens *after* the shared prefix).
8. Write back, backup, report.

After running, re-run `derive-groups` to populate `groupName` / `groupImage`.

Conservative heuristic: cluster must share at least one full uppercase token of length ≥ 4 (e.g. "YOUTHFILL"), and at most 2 shared tokens. Stoplist: `PRODUCT`, `MIS`, `NEO`, `DR`, `DK`, `JBP` (these tend to be too generic or already-handled).

## Verification

1. After Unit 1: grid + list cards for the REGENOVUE group show `#3-8`. Solo products still show their single ID.
2. After Unit 2: searching "neurami" returns the Neuramis bundle card (with BUNDLE marker) followed by individual NEURAMIS LIGHT, NEURAMIS DEEP, etc. cards.
3. After Unit 3: `node -e "const d=require('./data/products.json'); const g=new Set(d.products.map(p=>p.groupId).filter(Boolean)); console.log('groupIds:', g.size)"` shows > 33 groups (target: 40-50).
4. `npx tsc --noEmit` clean, `npm run lint` baseline, `npm run build` clean.
5. Manual: open catalogue, verify range display + bundle marker on search. Open a grouped variant's detail page — variant selector still works (no regression).

## Risks

- Unit 2 changes the *number* of rendered cards on search — could affect pagination math. Verify pagination still works.
- Unit 3 over-clustering: some categories have products that share a prefix but aren't really variants (e.g. multiple unrelated "JUVELOOK" products). Stoplist + visual review of the generated groupings catches this.
- Range display for groups whose variants are non-contiguous (e.g. BARBIE SLIM at ids 1 and 295) would render `#1-295` which is misleading. Cluster A noted this edge case. Mitigate: if `max - min > 50`, show `#{minId}+` instead of a range — flag in report.
