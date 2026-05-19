# Brand Rename + UI Polish + Bundle Composite Covers — Design

Date: 2026-05-19
Owner: alanhon1

## Problem

Five concerns from a single round of user feedback:

1. **Protocol templates are too long.** The previous pass applied
   6-12 line clinical templates per category. The user wants 1-sentence
   protocols (50-100 chars) — enough to be specific, short enough to
   read without skimming.
2. **Brand name spelling.** The UI shows "Lumière" everywhere; the
   correct production brand (and matching `lumeemaison.com` domain)
   is **"Lumée Maison"**. Every visible "Lumière" string in English
   should be replaced. Russian and Korean copy keeps the existing
   transliteration unchanged (only the Latin-script brand changes).
3. **Catalogue text too small + sharp corners.** Sidebar / card / top
   bar text feels cramped at the current `text-xs` base; borders are
   hard `rounded-sm`. Bump one tier (`text-xs → text-sm`,
   `text-[10px] → text-xs`) and round corners to `rounded-md`.
4. **Catalogue count is misleading.** The top bar shows the deduped
   card count (290) but users read it as "products". Show both:
   `290 cards / 421 products`. Update the hardcoded "438 products"
   strings on the catalogue page heading, the home hero, and the i18n
   messages to 421.
5. **Bundle covers are a single variant image.** Bundles need a
   composite cover that visibly contains all variant images on a
   single canvas. Grid layout per variant count (1x2 / 2x2 / 2x3 /
   3x3), 800x800 px webp, written to `public/images/bundles/` and
   linked from every variant's `groupImage`.

## Source of truth

- Existing `data/products.json` for the data shape.
- Existing `public/images/products/product-{id}.{ext}` files for the
  composite source images (those already on disk after the prior
  passes).
- User-supplied brand spelling: "Lumée Maison" (Latin script only).

## Non-goals

- No re-translation of Korean / Russian copy.
- No new schema fields on `Product`.
- No dynamic product-count computation in the UI (hardcoded 421 with a
  short comment is acceptable for this pass).
- No text labels on the composite cover (just the variant images).
- No edit to individual product images on disk; only the new
  `public/images/bundles/` directory is created.

## Design

### A. `scripts/shorten-protocols.ts`

Idempotent. Backs up `data/products.json`, then for every product
whose `protocol` matches any of the **long** category templates from
the previous pass, replaces it with a 1-sentence equivalent. Products
with Jotform-derived protocols (not template-shaped) are skipped.

Templates (one sentence each, 50-120 chars):

| categoryId | new protocol |
|---|---|
| `fillers` | Inject at the indicated dermal depth using a 27-30G needle; aspirate before each bolus. |
| `mesotherapy` | Inject intradermally at 1-4 mm depth using a 30G needle; cycle weekly for 4-8 sessions. |
| `acne-treatment` | Apply a thin layer to clean, dry skin 1-2× daily; pair with broad-spectrum SPF 30+. |
| `hair-treatment` | Apply or inject at the scalp at 2-3 mm depth; cycle weekly for 4-6 sessions. |
| `pharmacy-favourites` | Use per product label and prescriber direction; observe storage and expiration. |
| `topical-cosmetics` | Apply a thin layer to clean, dry skin morning and/or evening; pair AM with SPF 30+. |
| `intimate-care` | Apply a small amount externally to the V-zone 1-2× daily; avoid mucosal surfaces. |
| `growth-factor-exosome` | Reconstitute with the supplied diluent; apply via microneedling or 30G mesotherapy. |
| `curenex` | Use per the Curenex product type; injectables go intradermally at 1-2 mm with a 30G needle. |
| `dermagen` | Apply a thin layer to clean, dry skin 1-2× daily; pair AM with broad-spectrum SPF 30+. |
| `gtm` | Apply per product type; in-clinic peels follow neutralization per the manufacturer protocol. |
| `equipment` | Reserved for trained operators; calibrate, configure per indication, treat in even passes. |
| `salon-grade` | Professional spa use; apply per product type and rinse or remove per the protocol. |
| `lipolytics` | Inject subcutaneously into the fat compartment at 6-13 mm depth using a 27-30G needle. |
| `botulinum` | Reconstitute with 0.9% saline; inject 0.1 mL per point using a 30-32G needle. |
| `injections` | Restricted to licensed practitioners; administer per package insert with a 27-30G needle. |
| `anesthetics` | Apply a thick layer under occlusion for 20-60 min; remove and start the procedure immediately. |
| `placental-therapy` | Administer intramuscularly or via subcutaneous mesotherapy 2-3× weekly for 4-8 weeks. |
| `nano-needle-cannula` | Sterile single-patient use; insert at the planned depth and deliver the product slowly. |
| `imported-products` | Follow the manufacturer's insert and applicable local regulations for the imported brand. |

The script detects "long template" protocols by checking the start of
the existing protocol against a set of leading phrases (e.g.
`Restricted to licensed practitioners trained in injectable techniques`)
that uniquely identify each long template. Any protocol that does not
start with one of those leading phrases is treated as Jotform-derived
or user-edited and is preserved.

Backup + report at `scripts/shorten-protocols-report.txt`:
sections **Applied** (id, name, category) and **Skipped** (id, name,
reason).

### B. `scripts/compose-bundle-covers.ts`

Idempotent (regenerates the same output if inputs are unchanged).
Uses `sharp` (already a dependency).

Steps per group with ≥ 2 members:
1. Collect each member's `image` path. Members without an image use a
   pre-generated grey placeholder image at
   `public/images/bundles/_placeholder.webp` (created lazily by the
   script on the first run via `sharp({ create: { ... } })`).
2. Determine the grid:
   - 2 variants → 1 row × 2 cols
   - 3-4 variants → 2 × 2
   - 5-6 variants → 2 × 3
   - 7+ variants → 3 × 3, first 9 variants only
3. Resize each source to fit one cell while preserving aspect
   (`fit: 'inside'`, white background).
4. Composite cells into an 800 × 800 canvas (cell sizes 800/cols ×
   800/rows). Use `sharp({ create: { background: '#ffffff' } })` for
   the base canvas and `composite([...])`.
5. Write to `public/images/bundles/bundle-{groupId}.webp` at 85%
   quality.
6. Set every member's `groupImage` to `/images/bundles/bundle-{groupId}.webp`.

Single-member groups, and groups whose `groupImage` is already a
bundle file at this path, are skipped.

Backup + report at `scripts/compose-bundle-covers-report.txt`:
**Composed** (groupId, member count, output path), **Skipped**
(groupId, reason), **Errors** (groupId, error).

### C. Brand text "Lumière" → "Lumée Maison"

Targeted Edit operations (no scripts):

- `components/layout/Header.tsx` (line 80): logo text.
- `components/layout/Footer.tsx` (line 19): logo text.
- `app/[locale]/catalogue/page.tsx` (line 27): brand mention if any.
- `app/[locale]/layout.tsx`: metadata title / description (verify
  before editing).
- `messages/en.json`: 6 strings.
- `messages/ko.json`: 6 strings (replace only the Latin "Lumière"
  occurrences, not the surrounding Hangul).
- `messages/ru.json`: 6 strings (same — only Latin script).

Korean / Russian *transliteration* of the brand stays as-is in those
locales because there isn't one (the original copy uses the Latin
"Lumière" inside Hangul / Cyrillic text). Replacing the Latin token
inline preserves the surrounding language.

### D. Catalogue count display + 438 → 421 cleanup

Top-bar count rewrite in `components/catalogue/CatalogueClient.tsx`
(line ~390):

```tsx
const cardCount = renders.length;
const totalCount = filterResult.isDualView
  ? renders.filter(r => !r.asBundle).length
  : renders.reduce((sum, r) => sum + (r.asBundle && r.product.groupId
      ? (variantCounts.get(r.product.groupId) ?? 1) : 1), 0);

// In the JSX:
{cardCount} cards / {totalCount} products
```

Hardcoded 438 strings:
- `app/[locale]/catalogue/page.tsx:27` — "438 products across 20 categories" → "421 products across 20 categories".
- `components/home/Hero.tsx:137` — `value: '438'` → `value: '421'`.
- `messages/en.json:62`, `ko.json:62`, `ru.json:62` — "438" → "421"
  (preserve surrounding language).

Add a one-line code comment near each hardcoded 421 saying
`// keep in sync with data/products.json product count`.

### E. UI text + corner tuning

`components/catalogue/CatalogueClient.tsx` and
`components/catalogue/ProductCard.tsx`.

Class swaps (replace-all within each file, carefully — don't touch
text in icon-only buttons):

- `text-[10px]` → `text-xs`
- `text-xs` → `text-sm` (only in contexts where the text is meaningful
  copy, not icon labels or absolute-positioned overlays)
- `rounded-sm` → `rounded-md`
- `p-4` → `p-5` (product card body) — keep header padding
- Aspect ratios untouched; let larger text wrap as needed (existing
  `line-clamp-2` keeps overflows in check).

Strategy: read each file once, identify the class strings on text
nodes specifically, swap. Avoid blind `replace_all` on the whole file
(would break icon-label `text-xs` or layout-critical `rounded-sm` on
indicator pills).

## Run order

1. `npx tsx scripts/shorten-protocols.ts`
2. `npx tsx scripts/compose-bundle-covers.ts`
3. Brand rename edits (C).
4. Count display edits (D).
5. UI class swaps (E).
6. `npx tsc --noEmit -p tsconfig.json` — zero errors.
7. Manual browser verification.

## Verification

Programmatic:
- `grep -c '"protocol":' data/products.json` unchanged (421 protocols
  still present).
- `grep -c 'Restricted to licensed practitioners trained in injectable' data/products.json` is 0 (long templates gone).
- `ls public/images/bundles/ | wc -l` ≈ 62 + placeholder.
- `grep -c 'Lumière' components/layout/ messages/` = 0 (after edits).
- `grep -c 'Lumée Maison' components/layout/Header.tsx` ≥ 1.

Manual:
- `/en` home — Hero stats card shows 421.
- `/en/catalogue` — top bar reads "N cards / M products" where N+M
  match expectations for the current filter.
- Bundles category — every card shows a composite cover (multiple
  variant images in a grid).
- Click any bundle → variant dropdown still shows real variants
  (data unchanged, only `groupImage` updated).
- Catalogue product page — protocol is 1 sentence.
- Catalogue sidebar and card body text noticeably bigger; corners
  are softer.

## Rollback

- `copy data\backups\products-{ts}.json data\products.json` restores
  protocol / groupImage.
- `public/images/bundles/` can be deleted entirely; UI falls back to
  individual `product.image` because the composer was the only writer
  of `bundle-*.webp` paths.
- Brand / count / UI edits are small git diffs reverted via
  `git revert`.

## Out of scope (follow-ups)

- Translating updated English copy into Russian / Korean.
- Adding text labels onto bundle covers.
- Dynamic (build-time) computation of total product count to replace
  the hardcoded 421.
- Re-protocol from rich web research (deferred indefinitely).
