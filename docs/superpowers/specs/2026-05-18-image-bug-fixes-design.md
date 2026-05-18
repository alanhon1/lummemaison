# Spec: Cluster A — Image/Cover Bug Fixes

**Date**: 2026-05-18
**Status**: Approved (autonomous mode — first of 5 clusters)
**Scope batch**: Cluster A of 5 (post-JotForm-sync cleanup). User-recommended order: A → B → C → D → E.

## Background

The prior JotForm sync (commits `9de9497`, `8d1ab68`, `1889c3e`) imported 386 of 438 product photos via a fuzzy-name matcher. The match was 88% on quantity but contains real false-positives — e.g.:

- **id 17 `VOM LIGHT (CE) NO Lidocaine`** matched a REGENOVUE FINE JotForm entry (wrong product).
- **id 21 `NEURAMIS`** never matched anything (image empty); the Neuramis group cover therefore falls back to id 20 `NEURAMIS LIGHT (MESO)`.
- **id 23 `NEURAMIS DEEP WITH LIDOCAINE`** carries the same `variantLabel: "DEEP"` as id 22 `NEURAMIS DEEP`, making the variant selector ambiguous.
- Several products' names in `data/products.json` have stray inner whitespace (e.g. `VOM INTEN S E`, `M EDITOXIN`, `RE N TOX`, `2 XSOME`, `H YALACE`) which defeats the token matcher. The Task-2 reviewer flagged this would recover ~8 more matches if cleaned.

The codebase already has the audit infrastructure used in commit `26e5deb`: `scripts/audit-prep.ts` batches 30 products per file; vision-capable subagents inspect each image and emit `CONFIRMED | MISMATCH | UNCERTAIN`; `scripts/audit-apply.ts` clears mismatches. This spec re-runs that pipeline on the post-JotForm state and adds a second-pass re-sourcing stage.

## Goals

1. **Clean whitespace-mangled product names** in `data/products.json` so the matcher can recover the products it missed during the JotForm sync. Names like `VOM INTEN S E` → `VOM INTENSE`, `H YALACE` → `HYALACE`. Conservative — only fixes that look like single stray spaces inside otherwise-uppercase tokens.
2. **Re-run the vision audit** across all products that currently carry an image. Use the existing `audit-prep.ts` → vision-subagents → `audit-apply.ts` pipeline.
3. **Re-source cleared products** from the on-disk `scripts/jotform-scrape.json` using a smarter matcher this round — the pool of candidates is the *unclaimed* JotForm entries from the prior sync, and the targets are the post-audit cleared products plus the original 52 unmatched.
4. **Fix `variantLabel` collisions** within groups so each variant is uniquely labeled. Specifically: products with identical variantLabel inside the same group get a disambiguating suffix (e.g. NEURAMIS DEEP vs NEURAMIS DEEP WITH LIDOCAINE → `"DEEP"` vs `"DEEP + LIDO"`).
5. **Refresh `groupName` / `groupImage`** via `derive-group-display.ts` after the new images land.

## Non-goals (YAGNI)

- Cluster B (catalogue edge softening) — separate spec.
- Cluster C (group model overhaul: renumbering, range display, search-shows-group+singles, more grouping) — separate spec.
- Cluster D (enriched descriptions) — separate spec.
- Cluster E (photo quality upgrades) — separate spec.
- The PDF (`public/APR2026-CATALOGUE.pdf`) as an image source. The JotForm is equivalent and already scraped.
- New 1-to-1 image curation by name — fully automated pipeline. Anything still wrong after this cluster gets flagged in the audit report for a human follow-up.

## Current state (verified 2026-05-18)

- `data/products.json`: 438 products. 386 have `image: '/images/products/product-<id>.webp'`. 52 have `image: ""`.
- `public/images/products/`: 386 `.webp` files plus `.gitkeep`.
- `scripts/jotform-scrape.json`: 511 JotForm entries (committed via gitignore but present on disk from the prior sync run).
- `scripts/jotform-raw.html`: 3.5 MB raw HTML from the prior sync.
- `scripts/audit-prep.ts`, `scripts/audit-apply.ts`, `scripts/audit-batches/*` exist from commit `26e5deb`. Vision-subagent prompt template is implicit in their structure; the pipeline expects subagents to write `{ id, status, reason }` entries to a results JSON that `audit-apply` consumes.
- `scripts/derive-group-display.ts` derives `groupName` and `groupImage` from the longest leading uppercase token.
- 33 product groups exist; some have variantLabel collisions inside (e.g. Neuramis group has two `"DEEP"`).

## Design

Five linear units in one script-driven pipeline. Each unit ends in a commit so progress is auditable.

### Unit 1 — Clean whitespace-mangled product names

**File:** new script `scripts/clean-mangled-names.ts`.

The script reads `data/products.json` and applies a small set of conservative rewrites to the `name` field of each product. Examples (from the sync report's unmatched list):

| Mangled name | Cleaned name |
|---|---|
| `VOM INTEN S E` | `VOM INTENSE` |
| `H YALACE` | `HYALACE` |
| `M EDITOXIN` | `MEDITOXIN` |
| `RE N TOX` | `RENTOX` |
| `2 XSOME` | `2XSOME` |
| `E XOXE` | `EXOXE` |
| `E TREBELLE` | `ETREBELLE` |
| `M UCHCAINE` | `MUCHCAINE` |

Rule: collapse a single inner space between (a) a single uppercase letter and (b) a longer uppercase fragment. The regex is `\b([A-Z0-9])\s+([A-Z][A-Z0-9]{1,})\b` applied iteratively until no more rewrites match. Backup `data/products.json` first; emit a one-line-per-rewrite report to `scripts/clean-mangled-names-report.txt`.

Add npm script `"clean-mangled-names": "tsx scripts/clean-mangled-names.ts"`.

### Unit 2 — Re-run vision audit

Re-use the existing infrastructure:

1. `npm run audit-prep` — splits the 386 products-with-images into 13 batches of 30 in `scripts/audit-batches/`.
2. Dispatch 13 vision-capable subagents in series (one per batch). Each subagent is told: read each image in the batch, compare against the product name + category, emit JSON `[{ id, status, reason }, ...]` where status is `CONFIRMED | MISMATCH | UNCERTAIN`.
3. Concatenate the per-batch outputs into `scripts/audit-results.json`.
4. `npm run audit-apply` — clears `image` for every MISMATCH / UNCERTAIN product, backs up `data/products.json`, writes `scripts/audit-report.txt`.

After this unit, products with confirmed-wrong images have `image: ""` and are ready for re-sourcing.

### Unit 3 — Re-source cleared + originally-unmatched products

**File:** new script `scripts/refill-from-jotform.ts`.

Reads:
- `data/products.json` (target: products with `image: ""`)
- `scripts/jotform-scrape.json` (511 candidates)

The candidate pool is **every** JotForm entry whose `imageUrl` is not already used by another product in the current `data/products.json`. This means JotForm entries previously claimed by mismatches (which got cleared in Unit 2) are released back into the pool.

For each `image:""` product:
- Compute `normalise(p.name)`.
- Compute `scoreMatch(pnorm, normalise(jp.name))` for every candidate in the pool.
- Pick the highest-scoring candidate ≥ MATCH_THRESHOLD (default 2 — same as the tuned JotForm sync threshold).
- Mark the candidate consumed; remove from pool.

Then download the image (same `axios + sharp → webp` pipeline as `sync-from-jotform.ts`), save to `public/images/products/product-<id>.webp`, update `image` field.

Emit `scripts/refill-from-jotform-report.txt` showing matched / failed / still-unmatched.

Add npm script `"refill-from-jotform": "tsx scripts/refill-from-jotform.ts"`.

### Unit 4 — Fix variantLabel collisions inside groups

**File:** new script `scripts/fix-variant-labels.ts`.

Reads `data/products.json`. For each group:
- Detect any pair of products with identical `variantLabel`.
- For the LATER product (by `id`), derive a disambiguating suffix from the *name* of the product. The most common case is `"X" vs "X WITH LIDOCAINE"` → relabel the latter as `"X + LIDO"`. Generalized:

```ts
function disambiguate(name: string, existingLabel: string): string {
  const upper = name.toUpperCase();
  if (upper.includes('LIDOCAINE') || upper.includes('LIDO')) return `${existingLabel} + LIDO`;
  if (upper.includes('PLUS')) return `${existingLabel} +`;
  if (upper.includes('NO LIDOCAINE')) return `${existingLabel} (NO LIDO)`;
  if (upper.includes('IMPLANT')) return `${existingLabel} (IMPLANT)`;
  // Fall back to the trailing non-shared token from the name
  const tokens = name.split(/\s+/);
  return `${existingLabel} (${tokens[tokens.length - 1]})`;
}
```

Backup, write, report to `scripts/fix-variant-labels-report.txt`. Add npm script `"fix-variant-labels": "tsx scripts/fix-variant-labels.ts"`.

### Unit 5 — Refresh `groupName` / `groupImage`

Run the existing `npm run derive-groups`. No code changes. This picks a fresh group cover image from the now-corrected variant images, and updates groupName if cleaning the mangled names changed the longest-shared-prefix.

## Verification

1. The audit report (`scripts/audit-report.txt`) lists the MISMATCH set. Spot-check 3 entries the user cited (id 17 VOM LIGHT, id 23 NEURAMIS DEEP WITH LIDOCAINE) — they should be in MISMATCH and have been cleared.
2. After re-sourcing, those same product ids should have a populated `image` again, pointing to a different `.webp` than before.
3. `node -e "const d=require('./data/products.json'); console.log('with image:', d.products.filter(p=>p.image).length, '/ 438')"` — target: ≥390.
4. `data/products.json`: no two products in the same `groupId` share the same `variantLabel`.
5. `npx tsc --noEmit`, `npm run lint`, `npm run build` — all green.
6. Manual: open `/en/product/21` (NEURAMIS) — image renders (not the LIGHT MESO image, and not empty). Open the catalogue, locate the Neuramis group card — its cover should now be the actual NEURAMIS variant or a sensible default.

## Implementation notes & risks

- **Vision subagent dispatch cost.** 13 subagents × ~30 images each = 390 vision evaluations. Acceptable, but pace through them in series to avoid resource contention. Each subagent must report its full results JSON; the orchestrator concatenates.
- **MISMATCH false-positive risk.** Vision subagents may flag a correct image as MISMATCH when the JotForm photo shows a sibling product (e.g. a packaging set vs a single box). The audit report's `reason` field is the human-readable check. After Unit 2, scan the report for surprises and only re-source what's actually wrong.
- **Re-sourcing may steal an image.** If a previously-correct match's JotForm entry happens to score higher for a different cleared product, the rematch could be wrong. Mitigate by setting `MATCH_THRESHOLD = 3` in `refill-from-jotform.ts` (slightly stricter than the original sync's 2) to reduce false-positive risk on the smaller pool.
- **Whitespace-cleanup over-correction.** A name like `JBP nano cannula 22G` legitimately has internal spaces. The regex specifically matches *single uppercase letter + space + longer uppercase fragment*, so `nano cannula` (lowercase) isn't touched. Run the cleanup, eyeball the report, accept or revert.
- **Group cover bug specific to Neuramis.** After Unit 3, if id 21 NEURAMIS has a sourced image, `derive-groups` will pick it as group cover (longest match? no — the script picks the first non-empty image in the group). The script's current logic: `picks the first existing image among variants`. We should verify which variant becomes the cover and whether that's the desired behavior. If not, a small tweak to `derive-group-display.ts` to prefer the variant whose name equals the group's bare name is a reasonable improvement — but stays out of scope unless the result is obviously wrong.

## Out-of-scope follow-ups

- The 125 unclaimed JotForm entries (from the prior sync report) may represent products that should be added to `data/products.json` but aren't there yet. That's a catalog-completeness question for a future cluster.
- The PDF (`public/APR2026-CATALOGUE.pdf`) hasn't been parsed. If JotForm + this audit don't resolve specific products, a PDF-image-extraction pass is a future option.
- Cluster C (group model overhaul) will re-revisit grouping logic and may obviate some of Unit 4's variant-label fixes. That's fine — Cluster A makes the model less broken now; Cluster C re-architects later.
