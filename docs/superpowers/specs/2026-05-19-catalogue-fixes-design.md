# Catalogue Fixes — Design

Date: 2026-05-19
Owner: alanhon1
Follow-up to: `2026-05-19-variant-labels-and-images-design.md`

## Problem

After two earlier repair passes the catalogue still has multiple
data-quality and UX defects the user surfaced during browser-side
verification:

1. **Sandwich-gap bundles.** In the dermagen category, products 228-231
   (Dr. Picos × 3 + Cindelria × 1) sit between members of the
   `dermagen-dermagen` group (227 and 232-245) but lack a `groupId` of
   their own, so the catalogue renders them as standalone cards.
2. **`Back to Catalogue` loses page/filter state.** When a user clicks
   into a product from catalogue page 7 with a search active and then
   hits *Back*, they land back on the catalogue's default state (page 1,
   no filter). `BackToCatalogueButton` derives its target from
   `document.referrer`, but Next.js client-side navigation does not
   reliably update `document.referrer`.
3. **Wrong images.** Several products still display visually unrelated
   images that were assigned by earlier auto-mapping passes. Examples
   from manual inspection: id 3 (REGENOVUE FINE) shows a SOSUM image; id
   17 (VOM LIGHT) shows a REGENOVUE; id 84 (ULTRA GEN) shows a TESORO;
   id 216 (CURENEX PDRN) shows a MISFILL; etc.
4. **Duplicate-key React error in bundles.** The console reports
   `Encountered two children with the same key, "bundle-soonsu-mesotherapy"`.
   In the search-mode dual view the first variant of each group gets
   pushed into both the bundle-card list and the individual-card list,
   and the render key for those two renders collides.
5. **Search relevance.** Fuse.js threshold is 0.4 and the keys include
   `description`, `categoryId`, and `groupId`, so a query like `sosum`
   returns NEURAMIS and JUVIDERM hits via description fuzz-matching.
   Additionally the dual-view duplicate-key issue manifests as multiple
   identical bundle cards in the search result list.

The user also identified specific corrections across many product IDs
(image swaps, bundle merges, bundle splits, manual image mappings that
`auto-map-name-images` did not catch, etc.). The exhaustive list lives
inline in this document.

## Source of truth

- For names and specs: `products.txt` + the catalogue PDF.
- For "this image is wrong" / "these two products belong in the same
  bundle": the user's hand-curated list captured in this spec.

## Non-goals

- No re-numbering of product IDs.
- No new schema fields on `Product`.
- No re-translation of `data/translations/ru.json` / `ko.json`.
- No price discovery — id 141 stays at its current value and is flagged
  in the report for a follow-up.
- No sourcing of new images from the web. Anything we can't fix from
  `missing finds/` plus user-confirmed mappings stays blank.

## Design

### A. `scripts/catalogue-fixes.ts` — one consolidated data script

Idempotent. Each step is gated on "is the change already applied?" so
re-running is a no-op aside from the timestamped backup.

Steps in order (each step writes to `data/products.json` and to the
in-memory report):

**A1. Backup.** Copy `data/products.json` to
`data/backups/products-{ISO}.json`.

**A2. Bundle merges.** For each `(id, groupId)` rule, set
`product.groupId = groupId` if currently absent or different:

| IDs | Target groupId |
|---|---|
| 20, 21, 22, 23, 24 | `neuramis` |
| 38, 39, 40 | `youthfill` (override id 40's stale `youthfill-pn-with-lido`) |
| 44 | `celosome` (existing group has 45-47) |
| 51, 52, 53, 54 | `chaeum` |
| 228, 229, 230, 231 | `dermagen-dermagen` (existing group has 227, 232-245) |
| 323, 324 | `meditoxin` |
| 325, 326 | `re-n-tox` |

**A3. Bundle splits.** Clear `groupId`, `variantLabel`, `groupName`,
`groupImage` for these IDs (they are mis-grouped today):

- 89 YOUTHFILL PN — different product family from YOUTHFILL FINE/DEEP/SHAPE
- 66 MisAdi Hard — its own product
- 103 MISADI CO2 Mask — its own product
- 106 CINDELLA I — separate from CINDELLA SET (355) + CINDELLA INJ (356)
- 387 WELLSCAINE PLUS CREAM — separate from 389
- 389 WELLSCAINE CREAM — separate from 387

**A4. Image clears** (set `image = ""`):

3, 4, 17, 84, 216, 348, 349, 387, 408, 409, 410, 411.

**A5. CURENEX 224 deletion.** Remove the product whose id is 224 and
whose name matches `/^CURENEX\s+SCULP$/i`. (215 is the surviving SCULP.)

**A6. Image swaps.** For each pair `(a, b)`, exchange the `image`
fields. Do NOT touch the underlying files on disk — only the JSON
field; the renamed image paths will point to existing on-disk files
because both products had files before the swap.

| Pair | Reason |
|---|---|
| 21 ↔ 22 | NEURAMIS / NEURAMIS DEEP swapped |
| 66 ↔ 103 | MisAdi Hard / MISADI CO2 Mask swapped |
| 119 ↔ 121 | MIRACLE X / MIRACLE L swapped |

**A7. Apply manual `missing finds` mappings.** Copy from `missing finds/`
to `public/images/products/product-{id}.{ext}` (overwrite if existing),
and set `product.image` accordingly. Skip a rule if the source file is
absent (record in report):

| File | Target id |
|---|---|
| `Adimis-Body-Filler.jpg` | 67 |
| `maxy-fill-2.webp` | 69 |
| `ULTRAGEN_X_Middle.webp` | 84 |
| `neuramis light(meso).jpg` | 20 |
| `Neuramis-Lidocain.jpg` | 21 (post-swap, so points to NEURAMIS) |
| `neuramis deep lido.png` | 23 |
| `REGENOVUE_SUB_Q.webp` | 5 |
| `eng_pl_Regenovue-Fine-Plus-1-1-ml-CE-94_1_1.jpg` | 6 |
| `eng_pl_Regenovue-Deep-Plus-1-1-ml-CE-97_1_1.jpg` | 7 |
| `eng_pl_Regenovue-Sub-Q-Plus-1-1-ml-CE-96_1_1.jpg` | 8 |
| `curenex-rejuvenating-cream-for-day-and-night-with-pdrn-4.06-fl-oz-getglowing-skincare__88885.jpg` | 218 |
| `dermagen-well.jpg` | 233 |
| `dermagen urea cream deep.jpg` | 235 |
| `dermagen lunatox (not lunato).jpg` | 239 |
| `PEPTICULE ULTIMATE REJUVENATION CREAM.webp` | 264 |
| `PEPTICULE ULTIMATE REJUVENATION SERUM.png` | 265 |
| `vns lipolyticsolution vns fat.jpg` | 307 |
| `meditoxin-200u-botox-injections.jpg` | 324 |
| `Re-N-Tox-200u-.jpg` | 325 (already applied via apply-manual; re-run safe) |
| `Rentox100u.webp` | 326 (already applied; re-run safe) |
| `MASI Injection 10% (Magnesium.jpg` | 338 |
| `CHIOCTOCIN_INJ_2.jpg` | 386 |
| `Zinc S Inj..jpg` | 382 |
| `CORETOX_100U___MEDYTOX__2.png` | 334 |
| `multivita-lyophilized.jpg` | 372 |
| `regenovue-aqua-shine-plus-getglowing-skincare__30485.jpg` | 91 |
| `regenovue-aqua-shine-silver-9ml-getglowing-skincare__07632.jpg` | 92 |
| `regenovue-pn-non.jpg` | 90 |
| `revolax-sub-q-with-lidocaine-12.webp` | 28 |
| `vanhalla niacinamide skin tone balance.webp` | 195 |
| `elaxenpllaaestheticsukforskin.jpg` | 101 |

Additional `missing finds/` files (`BEADS-Max-Body-Classic`, `DN16`,
`Dermaheal-HL`, `ETREBELLE`, `Lipo-Shrinker`, `restylane-lyft`,
`misadi-h`, `misfill pdrn`, `p198-exonature`, `WILLCAM`, `autodn_mts`,
`Vita-D 200u`, `lipolabgms`, `ULTRATONING`) need precise IDs the user
must confirm — record in the report as "unmapped" and skip.

**A8. CURENEX 215-223 variant labels.** After A2-A7 the
`curenex-bundle` group has 11 members (215, 216, 217, 218, 219, 220,
221, 222, 223, 225, 226 — 224 deleted in A5). The post-CURENEX-prefix
suffix on each name is unique within the group. Set `variantLabel`
explicitly per member to the suffix (so `regen-variant-labels.ts`'s
fallback doesn't kick in again):

| id | variantLabel |
|---|---|
| 215 | `SCULP (PLLA)` |
| 216 | `PDRN, Multi` |
| 217 | `DAILY CARE SKINBOOSTER (SERUM)` |
| 218 | `REJUVENATING CREAM` |
| 219 | `HYDRATING CLEANSER` |
| 220 | `LIPO (FACE AND BODY)` |
| 221 | `REJUVENATING MASK` |
| 222 | `EXO BRIGHTENING CREAM` |
| 223 | `EYE PN` |
| 225 | `SNOW PEEL` |
| 226 | `SHEER SUNSCREEN` |

(The next pass through `regen-variant-labels.ts` will see these are
already set and skip them.)

**A9. Report.** Write `scripts/catalogue-fixes-report.txt` with sections:
merged, split, image-cleared, deleted, swapped, manual-mapped,
manual-mapped-skipped, curenex-labels-set.

### B. `scripts/regen-variant-labels.ts` — re-run

After A, run the existing `regen-variant-labels.ts` to refresh
`variantLabel` and `groupImage` for newly-merged / newly-split groups.

### C. UI fixes

**C1. `components/catalogue/CatalogueClient.tsx` — duplicate key fix +
search tuning.**

Change the search-mode return shape so render position is explicit:

```ts
type Render = { product: Product; asBundle: boolean };
const items: Render[] = [];
const seen = new Set<string>();
for (const p of result) {
  if (p.groupId) {
    if (!seen.has(p.groupId)) {
      items.push({ product: p, asBundle: true });
      seen.add(p.groupId);
    }
    items.push({ product: p, asBundle: false });
  } else {
    items.push({ product: p, asBundle: false });
  }
}
```

Render key becomes `r.asBundle ? \`bundle-${r.product.groupId}\` : \`solo-${r.product.id}\``, and the `isBundle` prop on `ProductCard` is `r.asBundle`. Variants of the same group are no longer keyed identically.

Tighten Fuse:

```ts
const fuseOptions = {
  threshold: 0.2,
  keys: [
    { name: 'name', weight: 3 },
    { name: 'groupName', weight: 2 },
  ],
};
```

Drop `specification`, `description`, `categoryId`, `groupId` from search keys.

**C2. `components/catalogue/ProductCard.tsx` — remember catalogue URL.**

Add an onClick handler to the Link that saves the current URL when
navigating to the product detail:

```tsx
function rememberCatalogueUrl() {
  if (typeof window === 'undefined') return;
  if (!window.location.pathname.includes('/catalogue')) return;
  sessionStorage.setItem('catalogue:lastUrl', window.location.pathname + window.location.search);
}
```

Attach to both list and grid Link elements:
`<Link href={...} onClick={rememberCatalogueUrl}>`.

**C3. `components/catalogue/BackToCatalogueButton.tsx` — prefer session URL.**

Replace the `document.referrer` logic with:

```tsx
useEffect(() => {
  const saved = typeof window !== 'undefined'
    ? sessionStorage.getItem('catalogue:lastUrl')
    : null;
  if (saved) {
    const m = saved.match(/^\/[^/]+\/catalogue(?:\/([^/]+))?/);
    const categoryId = m && m[1];
    const categoryName = categoryId ? categoriesById[categoryId] : undefined;
    setTarget({
      href: saved,
      label: categoryName ? `Back to ${categoryName}` : 'Back to Catalogue',
    });
    return;
  }
  // Fallback: try document.referrer (covers full-page-load arrivals from search engines).
  const referrer = typeof document !== 'undefined' ? document.referrer : '';
  if (!referrer) return;
  // existing fallback logic from current implementation
}, []);
```

### Run order

1. `npx tsx scripts/catalogue-fixes.ts`
2. `npx tsx scripts/regen-variant-labels.ts`
3. Apply UI fixes (C1, C2, C3)
4. Manual browser verification

## Verification

Programmatic:
- `npx tsc --noEmit -p tsconfig.json` — zero errors after C.
- `grep -c '"id": 224,' data/products.json` — 0 (deleted).
- `grep -c '"groupId": "youthfill-pn-with-lido"' data/products.json` — 0
  (id 40 was the only member).
- `scripts/catalogue-fixes-report.txt` matches expected counts (merged 17,
  split 6, image-cleared 12, deleted 1, swapped 3, manual-mapped 30+,
  curenex-labels-set 11).

Manual:
- Dermagen category: 227-245 render as a single bundle card.
- `?q=sosum` → bundle card + 5 SOSUM variants, nothing else.
- Catalogue page 7 → click product → *Back* → page 7 with search still active.
- Console: no `duplicate key` errors.
- ids 3, 4, 17, 84, 216, 349, 387, 408-411: show placeholder, not wrong image.
- ids 67 (AdiMis), 69 (MAXY FILL), 84 (ULTRA GEN, post-mapping): correct image.

## Rollback

`copy data\backups\products-{timestamp}.json data\products.json`

Image swaps only touched JSON fields; on-disk image files are unchanged.
Manual mappings copied files but never deleted any. Reverting the JSON
restores everything to pre-script state.

## Out of scope (follow-ups)

- id 141 DERMAHEAL SR price discovery.
- id 215/224 alternative resolution if user changes their mind on
  deletion.
- REJUBEAU MESO NEEDLE 408-411 color images (user said they should be
  yellow / green / black / orange; user to provide files).
- `missing finds/` files without confirmed product IDs: BEADS, DN16,
  Dermaheal-HL, ETREBELLE, Lipo-Shrinker, restylane-lyft, misadi-h,
  misfill pdrn, p198-exonature, WILLCAM, autodn_mts, Vita-D 200u,
  lipolabgms, ULTRATONING.
- 417 / 418 Sungshim image disambiguation (same image — needs new image
  for one of them).
