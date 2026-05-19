# Variant Labels + Auto Image Mapping — Design

Date: 2026-05-19
Owner: alanhon1
Follow-up to: `2026-05-19-product-data-fixes-design.md`

## Problem

After the initial repair pass, two user-visible data defects remain in
`data/products.json`:

1. **Variant labels are useless inside bundles.** When a bundle has
   multiple variants that share a name (e.g. three MUCHCAINE entries
   distinguished only by size in the `specification` field), the variant
   dropdown shows them as `"MUCHCAINE"`, `"MUCHCAINE"`, `"MUCHCAINE (MUCHCAINE)"`
   instead of `"100g"`, `"500g"`, `"30g"`. The parser-derived `variantLabel`
   field is either the bare name repeated or a `"X (X)"` artefact. The user
   cannot tell variants apart in the UI.

2. **Some products still have no image** even though `missing finds/`
   contains an image file whose stem begins with the product name. The
   previous repair pass only auto-mapped files whose filenames embedded the
   numeric product id (`NNNproduct`). Name-prefixed files like
   `EVEHILO_CENTRE_1800x1800.webp` or `EXOXE_middle_1800x1800.webp` were
   listed in the manual-mapping report but never applied. The user has
   confirmed that filename-prefix matches should be applied automatically.

   The user-reported missing-image IDs include
   80, 81, 87, 99, 130, 132, 207, 247, 304, 309, 323, 325, 326, 327, 334,
   338, 346, 357, 369, 383, 398, 399, 413, 414, 415, 416. A subset of these
   have prefix matches in `missing finds/`; the rest genuinely have no
   image yet and stay blank.

A third minor defect surfaces from the same data: 17 products belong to a
group whose `groupImage` is still empty even though at least one variant
in the same group has an image. The catalogue card falls back to the
first variant's image, but for clarity we should fill `groupImage` from
the first non-empty `image` in the group.

## Source of truth

`products.txt` and the in-place JSON. No external sources required.

## Non-goals

- No new schema fields on `Product`.
- No re-ranking of which variant is canonical inside a group.
- No re-translation of `data/translations/ru.json` / `ko.json`.
- No fix for IDs whose images genuinely don't exist on disk and have no
  prefix match in `missing finds/` — those stay blank and surface in a
  follow-up image acquisition task.
- No automatic deduplication of true duplicate variants — they are
  reported, not modified.

## Design

### A. Variant labels (`scripts/regen-variant-labels.ts`)

A new script. Idempotent (re-running on clean data is a no-op aside from
the timestamped backup).

Steps:
1. Backup `data/products.json` → `data/backups/products-{ISO}.json`.
2. Build a map of `groupId → variant[]` over all products with a
   `groupId`.
3. For each group, determine `variantLabel` per variant:
   1. If every `name` in the group is unique → `variantLabel = name` for
      each variant. Done for that group.
   2. Else, attempt spec-token extraction in this priority order, picking
      the FIRST pattern that yields a unique label for every variant in
      the group:
      - **Size**: `/(\d+(?:\.\d+)?)\s*(mL|ml|g|mg|cc|kg|oz|L)\b/i`,
        normalised to lowercase unit (e.g. "500g", "1.1mL").
      - **Concentration**: `/(\d+(?:\.\d+)?)\s*%/`, e.g. "10.56%".
      - **Count**: `/(?:x\s*)?(\d+)\s*(units?|U|IU|vials?|syr|syringes?|ampoules?|tabs?|sheets?|ea|pcs)\b/i`,
        normalised (e.g. "100 units", "5 syr").
      For each pattern, take the FIRST match in each variant's `spec`.
      Accept the pattern only if every variant in the group produces a
      different label.
   3. If none of the three patterns yields a fully unique set →
      fall back to `Variant 1`, `Variant 2`, … in the group's existing
      order, AND record the group in the report as "fallback-used".
   4. If two or more variants have identical `name` AND identical `spec`
      → record them in the report as "true-duplicate" and leave their
      existing `variantLabel` unchanged (the existing field may already
      be wrong, but we will not invent a label that fakes uniqueness).
4. **groupImage backfill** (same pass, separate inner loop): for each
   group, if `groupImage` is empty on every variant AND any variant has a
   non-empty `image`, set `groupImage` on every variant in the group to
   that first non-empty `image`. If every variant's `image` is empty,
   leave `groupImage` empty.
5. Write `data/products.json`.
6. Write report to `scripts/regen-variant-labels-report.txt`:
   - **Changed**: per group, list each variant `#id  before → after`
   - **Fallback-used**: groups where spec-token extraction failed
   - **True duplicates**: variant id pairs with identical name+spec
   - **GroupImage filled**: list of groups whose `groupImage` was set
7. Print summary to stdout (counts in each report section).

The script does NOT run `validate()` (no schema concerns). The repair
script's existing validator can be re-run separately if desired.

### B. Filename-prefix image mapping (`scripts/auto-map-name-images.ts`)

A new script. Idempotent. Re-running re-scans `missing finds/` and only
applies new matches.

Steps:
1. Backup `data/products.json` → `data/backups/products-{ISO}.json`.
2. List `missing finds/` files; filter to image extensions and skip files
   whose name matches `/\d+\s*product/i` (those were handled by
   `repair-products`).
3. For each remaining file:
   1. Extract the **stem** (drop extension) and split it on
      `[-_ ()]` to get tokens.
   2. Take the FIRST token whose length ≥ 3 characters; lowercase it for
      comparison. If no such token exists, skip the file and record as
      "no-usable-token".
   3. Find every product whose `name`'s first alphanumeric token
      (lowercase, stripping non-alphanumerics) equals the file token AND
      whose `image` is empty.
   4. Outcomes:
      - **Exactly one match** → copy the file to
        `public/images/products/product-{id}{ext}` (lowercased ext) if
        the target does not already exist with non-zero size; set
        `product.image = "/images/products/product-{id}{ext}"`; record
        as `auto-mapped`.
      - **Multiple matches** → record as `ambiguous` with the list of
        candidate ids; do not apply.
      - **No matches** → record as `no-match`.
4. Write `data/products.json`.
5. Write report to `scripts/auto-map-name-images-report.txt` with three
   sections: auto-mapped, ambiguous, no-match.
6. Print summary to stdout.

Token-length ≥ 3 stops false positives on filenames like `_2_XSOME_2.png`
(first usable token = "XSOME", which is fine), but rejects
`12-PIN_42-PIN_NEEDLE_286product.webp` from this pass (it would be picked
up by the numeric branch anyway).

## Run order

The two scripts are independent and can run in either order, but the
recommended sequence is:

1. `npx tsx scripts/auto-map-name-images.ts` — fills in `image` for
   products that had a prefix-matched file waiting.
2. `npx tsx scripts/regen-variant-labels.ts` — rewrites
   `variantLabel` everywhere and backfills `groupImage`. Running this
   after step 1 means more variants in a group have a usable `image`,
   so `groupImage` backfill catches more groups.

Both scripts add npm aliases in `package.json`:

```json
"auto-map-name-images": "tsx scripts/auto-map-name-images.ts",
"regen-variant-labels": "tsx scripts/regen-variant-labels.ts"
```

## Verification

Per-script:
- Script exits 0 with a clean report.
- Re-running is a no-op (no diff in `data/products.json` beyond a fresh
  backup).

Manual:
- Open `/en/product/<id>` for a MUCHCAINE variant and confirm the dropdown
  shows `100g`, `500g`, `30g` (not `MUCHCAINE`/`MUCHCAINE`/`MUCHCAINE (MUCHCAINE)`).
- Open the EVEHILO product page (id 80) and confirm an image is shown.
- Open the EXOXE product page (id 132) and confirm an image is shown.
- In the catalogue, scroll a bundle card and confirm `groupImage` renders
  for groups that previously fell back to nothing.

## Rollback

`copy data\backups\products-{timestamp}.json data\products.json`

If `auto-map-name-images.ts` copied files into
`public/images/products/`, those new files stay on disk after rollback;
remove manually if needed.

## Out of scope (follow-ups)

- IDs whose images don't exist anywhere yet (e.g. 81, 87, 99, 247, 304,
  323, 325-327, 334, 338, 346, 357, 369, 383, 398, 399, 413-416 — none
  of these have a filename-prefix match in `missing finds/`). A
  separate image-sourcing pass is needed.
- True-duplicate variants flagged in the regen report — user reviews
  the PDF and decides whether to merge or rewrite.
- Multi-match (ambiguous) entries in the auto-map report — user picks
  the correct product manually.
