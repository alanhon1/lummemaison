# Spec: Cluster D — Enriched Product Descriptions

**Date**: 2026-05-18
**Status**: Approved (autonomous mode — Cluster D of 5)

## Background

Product detail pages currently show: `description` (top-level), `specification` (a small panel), and an optional tab strip (`ProductDetailTabs.tsx`) with tabs for Description / Benefits / How to Use / Ingredients driven by `enrichedInfo`. The user wants the right column of the product page to show **one larger content section** structured as:

```
DESCRIPTION
---
INDICATION   PACKAGING   PROTOCOL
```

— with description on top, then a divider, then three labeled sub-blocks. Content should be in **English first** for every product. Translation to ru / ko is nice-to-have but explicitly low-priority.

## Goals

1. Add three new optional fields to `Product`: `indication`, `packaging`, `protocol` (all `string`). Existing `description` and `specification` are retained.
2. Replace (or supplement) `ProductDetailTabs` with a new component `ProductDetailContent` rendering the 4-block vertical section described above. The description block is visually prominent (the "extended downward" the user wants).
3. Generate English content for `description`, `indication`, `packaging`, `protocol` on every product where the field is currently empty. The content must be **conservative and factual** (no medical claims that aren't supported by the input data).
4. (Optional polish) Translate the new fields into `data/translations/{ru,ko}.json` so locale-aware rendering keeps working.
5. Backwards compatibility: existing `enrichedInfo` field is left intact (legacy). The new section uses the new fields only.

## Non-goals

- Cluster E (photo quality upgrades).
- Marketing copy or medical claims. Content stays descriptive: what the product *is* and *contains*, not what it *cures*.
- Re-running `ProductDetailTabs` with the new fields. The tabs component is sunsetted from the product page (kept as a file for now, just unmounted from the page).
- Per-variant content. All variants within a group share the new fields based on their own underlying data (each is generated independently).

## Current state (verified 2026-05-18)

- `lib/products.ts` `Product` interface has: `id`, `name`, `categoryId`, `specification`, `description`, `price`, `tags`, `isNew`, `isSale`, `isBestSeller`, `inStock`, `image`, `moq`, `enrichedInfo?`, `groupId?`, `variantLabel?`, `images?`, `groupName?`, `groupImage?`.
- `app/[locale]/product/[id]/page.tsx` renders `ProductGallery` + a right column with: id+category bar, name, gold-divider, VariantSelector, ProductPrice, specification panel, description paragraph (when no enrichedInfo), in-stock badge, ProductDetailClient (add-to-cart, etc.), tags, and `ProductDetailTabs` (when any enrichedInfo field is populated).
- `data/translations/{ru,ko}.json` already provide per-product translations for `description` and `specification`. Format: `{ "<id>": { "description": "...", "specification": "..." } }`.
- `lib/products.ts` has `getLocalizedDescription` / `getLocalizedSpecification`. Will extend to `getLocalizedIndication` / `getLocalizedPackaging` / `getLocalizedProtocol`.

## Design

Three phases, each ending in a commit.

### Phase 1 — Schema + UI (no content yet)

1. Extend `Product` type in `lib/products.ts` to add `indication?: string`, `packaging?: string`, `protocol?: string`. Add three localized getters mirroring `getLocalizedDescription`.
2. Create `components/catalogue/ProductDetailContent.tsx`:
   - Props: `product`, `locale`.
   - Layout: a tall card-like block (matches the height of the gallery on lg+ screens — `lg:min-h-[600px]` or similar). Inside:
     - "DESCRIPTION" small section header (gold underline)
     - The description body (uses `getLocalizedDescription`, falls back to a generic placeholder if empty)
     - A `gold-divider`
     - A responsive 3-column grid (single column on mobile, 3 on md+) with three sub-blocks: INDICATION, PACKAGING, PROTOCOL. Each shows its label + body.
   - If a sub-field is empty, render the label with a `—` body so the structure stays intact.
3. In `app/[locale]/product/[id]/page.tsx`, replace the existing `description` paragraph + `ProductDetailTabs` usage with `<ProductDetailContent />`. Keep specification panel (it's distinct — small inline summary).
4. Verify: build clean. Open `/en/product/1` — the new section renders the BARBIE SLIM description plus three empty `—` sub-blocks.

### Phase 2 — Generate English content via subagent batches

1. Create `scripts/enrich-prep.ts` that splits the 438 products into ~15 batches of 30 each, each batch as `scripts/enrich-batches/batch-{N}.json` with entries `{ id, name, categoryName, specification, description, jotformName?, jotformDescription? }`. JotForm descriptions can be read from `scripts/jotform-scrape.json` matched by id-to-image-url association (best-effort).
2. The orchestrator (controller) dispatches one content-generation subagent per batch. Each subagent emits `scripts/enrich-batches/result-{N}.json` containing `[{ id, description, indication, packaging, protocol }, ...]`.
3. The subagent prompt template constrains content:
   - English only.
   - `description`: 1-3 sentences. What the product is. No medical claims. Use the existing `description` as a base if available; otherwise compose from name + specification + category. If the existing description is already good, keep it verbatim.
   - `indication`: 1-2 sentences. What the product is **designed for** (e.g. "Designed for fine lines around the mouth and eyes."). NO disease/condition claims. NO "treats", "cures", "heals".
   - `packaging`: 1 sentence. Restate the specification in plain language (e.g. "Supplied as a 1.1 mL pre-filled syringe with a 27G needle.").
   - `protocol`: 1-3 sentences. Generic professional-use note (e.g. "For professional administration only. Follow standard sterile technique. Single-patient use."). Avoid dosage/depth specifics unless they're in the input.
4. Create `scripts/enrich-apply.ts` that reads all `result-{N}.json` files, merges into one map, backs up `data/products.json`, sets the four fields on each product, writes back, emits `scripts/enrich-report.txt`.

### Phase 3 — Translate to ru / ko (optional polish)

1. Create `scripts/translate-enriched-prep.ts` (mirror of the existing `translate-prep.ts`) that batches the new fields per-locale. ~13 batches per locale.
2. Dispatch translation subagents per batch, each emitting `data/translations/{locale}/batch-{N}.json`.
3. Run an apply script that merges per-locale results into `data/translations/{ru,ko}.json` alongside the existing `description` and `specification` entries.

Phase 3 can be skipped if Phase 2 takes too long; the UI falls back to English when a locale translation is missing.

## Verification

- After Phase 1: build clean; `/en/product/N` shows the new section with empty sub-blocks; no regression on existing tests.
- After Phase 2: every product has non-empty `description`, `indication`, `packaging`, `protocol`. Open 3-5 random product pages — content reads naturally, no obvious AI-hallucination markers, no medical claims.
- After Phase 3 (if executed): `/ru/product/N` and `/ko/product/N` render the localized content.
- `tsc` / `lint` / `build` all green throughout.

## Risks

- **AI hallucination**: subagent might generate plausible-sounding but wrong content. Mitigation: strict prompt template ("based ONLY on the input data, no invented facts"), and the user can spot-check after Phase 2. The content is regeneratable.
- **Medical liability**: "indication" sounds medical. We instruct the subagents to use *design intent* language ("designed for", "intended for cosmetic/professional use") rather than therapeutic claims. The user owns final review.
- **Translation drift**: Phase 3 translations might diverge from the original meaning. Mitigation: keep the English as source-of-truth; translations are advisory; `getLocalized*` falls back to English when a locale entry is missing.
- **Content volume**: 438 products × 4 fields × ~50 words ≈ 90k words. At ~1.3 tokens/word that's ~120k tokens of generation. Acceptable cost given ~15 subagent dispatches.

## Out-of-scope follow-ups

- Per-variant differentiated content (a Sosum S vs Sosum M getting different protocol notes for sizing). All variants get the same content from their own row's data; manual divergence later if needed.
- Spec-based variantLabel improvements (still showing "MUCHCAINE (MUCHCAINE)" etc. from Cluster C).
- Removal of `enrichedInfo` field from the schema. Leave for now.
