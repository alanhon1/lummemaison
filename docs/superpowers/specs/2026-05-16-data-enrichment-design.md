# Spec 2: Data Enrichment — Image/Description Audit, Multi-Source Fill, Bundle Display

**Date**: 2026-05-16
**Status**: Approved (awaiting plan)
**Scope batch**: 2 of 4 (Lumière post-launch improvements)

## Background

Lumière ships with 438 Korean cosmetic products mapped to images and descriptions scraped from `aesthetics-shop.com`. The first matching pass (commits up to `cf87ca9`) used fuzzy name matching with a low confidence threshold (`score ≥ 2`), which produced many false positives — products with wrong images attached (e.g. `ELASTY FINE PLUS` showing a `bonetta` image, `NEURAMIS VOLUME` showing `yvoire volume`, `VOM LIGHT` showing `lidocaine hci 2`). These mismatches are the worst class of catalog defect because they actively mislead a wholesale buyer.

A secondary problem: 11 products have no image at all, and 76 products have weak/no description (<50 chars) because `aesthetics-shop.com` had no entry for them.

A third problem: products that belong to a group (33 groups, 89 products — e.g. the five `SOSUM` variants) are correctly deduplicated in the catalog grid (commit `550238c`), but the deduplicated card still displays the variant-level name (e.g. `REGENOVUE FINE PLUS (CE)`) and the variant-level image, not a clean group label (`Regenovue`) with a bundle photo.

This spec fixes all three problems in a single coordinated pass.

The remaining post-launch work (not in this spec):
- **Spec 3** — group/bundle catalog UX (Bundles category, group-aware search), gallery `‹ ›` controls, home page sparkle effect
- **Spec 4** — translation pipeline for descriptions and specifications

## Goals

1. **Detect and remove mismatched images** across all 438 products using Claude Code subagent vision (no API key required — uses session inference).
2. **Refill the cleared slots and the existing gaps** (11 images, 76 descriptions) from a second scraping source, with every fetched image re-verified by the same subagent vision pass before being persisted.
3. **Produce `public/missingproducts.txt`** listing every product that still lacks an image or description after both passes.
4. **Add group-level display fields** (`groupName`, `groupImage`) and update the catalog card to use them for deduplicated group entries.

## Non-goals (YAGNI)

- A manual review dashboard. AI vision is accurate enough; the report file gives the user a spot-check trail.
- "Bundles" as a top-level catalog category — Spec 3.
- Cross-group search tags (e.g. searching `sosum m` returns the full Sosum group) — Spec 3.
- Translating descriptions/specifications to RU/KO — Spec 4.
- Rewriting product names that are stored as `Product 70`, `Product 247`, etc. — those are listed in `missingproducts.txt` for the user to source manually. Auto-generating fake names from the catalogue PDF is out of scope.
- Improving the original fuzzy matcher itself. We're layering verification on top, not redesigning the matcher.

## Current state (verified 2026-05-16)

- 438 products in `data/products.json`.
- 427 have a non-empty `image` field. The 11 without: ids 70, 77, 169, 247, 267, 279, 287, 307, 309, 386, 430.
- 362 have a description of usable length (>50 chars). 76 have short/empty descriptions.
- 89 products carry a `groupId` (across 33 distinct groups). Examples: `regenovue-sub-q` (6 variants), `sosum` (5), `tesoro-sub-q-with-lido` (5), `ultrafill-nose` (5), `neuramis` (4).
- Existing scrape/sync scripts already cover the aesthetics-shop pipeline: `sync-from-aesthetics-shop.ts`, `scrape-descriptions.ts`, `scrape-gallery-images.ts`, `group-products.ts`, `fix-product-images.ts`, `fill-descriptions.ts`. These are the foundation; the new work layers verification + a second source + group-display fields on top.
- The catalog already deduplicates grouped products (`ProductCard.tsx`, `CatalogueClient.tsx`) and shows an "N options" pill. What's missing is the *display* of the group: it still shows variant name + variant image.
- Backup system exists (`lib/backup.ts`); `data/backups/products-*.json` snapshots are taken on save.

## Design

Three sequential phases, each producing a commit and a report file. Phases share infrastructure (the subagent-vision batching pattern from Phase 1, the secondary-source scrape helper from Phase 2, and the existing backup system) but their concerns are distinct.

### Phase 1 — Audit existing image matches via Claude Code subagent vision

**Goal:** classify every existing `image` field as CONFIRMED, MISMATCH, or UNCERTAIN. Clear the field for the latter two so Phase 2 has clean slots to fill.

**Approach:** The user does not have an `ANTHROPIC_API_KEY`. Instead of a standalone Node script that calls the API, the audit runs as an **implementation task during plan execution**: the controller dispatches Claude Code subagents (general-purpose, model `sonnet` or `haiku`) that read the local product image files via the `Read` tool and classify them directly. No external API, no cost to the user — the work is amortised across the existing Claude Code session.

**Mechanics:**
- The controller iterates products in batches of 20 (avoids over-stuffing subagent context with images).
- For each batch, dispatch one subagent with a prompt containing:
  - The plan task text (explaining the classification job)
  - A JSON snippet listing the 20 products: `[{id, name, categoryName, imagePath}, ...]` where `imagePath` is the absolute path to the local file under `public/images/products/`.
  - Instruction: "For each product, use the Read tool on its imagePath to view the image. Match strictly by visible brand/product wording on packaging. Reply with one JSON object per product: `{id, status: 'CONFIRMED'|'MISMATCH'|'UNCERTAIN', reason: 'one short sentence'}`. Concatenate the 20 objects into a JSON array."
- Subagent returns 20 classifications per dispatch. Controller writes them into a running buffer.
- After all 22 batches complete (≈ 22 subagent dispatches, ≈ 1 hour wall time), the controller applies the buffer to `products.json` and writes the report.

**Cost:** $0 to the user — uses Claude Code session inference. Total run time around 1 hour for the full 438.

**Tradeoffs vs. an API-key approach:**
- Slower (subagent dispatch overhead per batch vs. fan-out API calls)
- Cannot be re-run unattended later from a cron or CI (requires a Claude Code session)
- Accepted because it's the right shape for a one-shot data quality fix with no recurring need

**Outputs:**
- Updated `data/products.json`: for any product where status is MISMATCH or UNCERTAIN, set `image` to empty string and add it to a working "to-refill" list (held in memory for Phase 2). Also clear the product's `images` (extra gallery images) array, since those came from the same wrong source.
- `scripts/audit-report.txt`: one block per product, sorted by status, format:
  ```
  === MISMATCH (N) ===
  #14  ELASTY FINE PLUS  →  reason: image shows "Bonetta" branded box
  #17  VOM LIGHT (CE) NO Lidocaine  →  reason: image is unrelated lidocaine vial
  …

  === UNCERTAIN (N) ===
  #82  …  →  reason: image is generic ampoule, brand not visible

  === CONFIRMED (N) ===
  #1   BARBIE SLIM
  …
  ```
- Backup written to `data/backups/products-{ISO}.json` before the data is mutated.

**Phase commit message:** `feat(data): audit and clear mismatched product images via subagent vision`

### Phase 2 — Multi-source refill with vision re-verification

**Goal:** fill every cleared image slot and every missing-or-short description using a second scraping source. Re-verify each fetched image through Phase 1's subagent vision pass before persisting.

**New file:** `scripts/sync-from-gofillerss.ts` — mirrors `sync-from-aesthetics-shop.ts`'s shape but targeted at `mg.gofillerss.com`. Discovers products via the site's sitemap or category index pages (whichever exists — to be determined by quick `WebFetch` during implementation). Uses the existing normalisation + fuzzy match helpers from `sync-from-aesthetics-shop.ts` (extract those into `scripts/lib/fuzzy-match.ts` so both scripts share one implementation rather than duplicating the regex).

**New file:** `scripts/refill-from-secondary.ts` — the scraping orchestrator. Reads `products.json`, iterates over all products with empty `image` OR short `description`, and for each:
1. Look up candidate in the gofillerss source by fuzzy match (`score ≥ 2`).
2. If found, download the candidate image to `public/images/products/product-{id}-secondary.webp` (a staging filename — do NOT overwrite until verified).
3. Read the candidate's short description from gofillerss, hold in memory.
4. **Do not** mark these as final yet. The script's output is a "candidates" JSON file (`scripts/secondary-candidates.json`) listing every staged image + candidate description for verification.

**Verification handoff:** After the scraping script produces `scripts/secondary-candidates.json`, the controller runs the same subagent-vision pattern from Phase 1 on the staged images. For each verified CONFIRMED: rename `product-{id}-secondary.webp` to `product-{id}.webp` and persist the description into `products.json`. For REJECTED or UNCERTAIN: delete the staging file and queue the product for `missingproducts.txt`.

**Why split scrape and verify:** the scraping is purely mechanical (and can be retried/resumed if the network blips); the verification is the careful, judgment-heavy step that benefits from being a discrete subagent task with a clean batch.

**Outputs:**
- Updated `data/products.json` with refilled fields.
- `scripts/refill-report.txt` (same shape as audit-report: groups by FILLED, REJECTED-BY-VISION, NO-CANDIDATE).
- `public/missingproducts.txt` written at the very end. Format:
  ```
  # missingproducts.txt
  # Last generated: 2026-05-16
  # Products that could not be enriched from aesthetics-shop.com or mg.gofillerss.com.
  # Manually source images and/or descriptions for these and add them via the admin UI.

  ID  | Name                          | Category    | Missing
  --- | ----------------------------- | ----------- | -----------------
  70  | Product 70                    | fillers     | name, image, description
  77  | DERMAGEN Plus NA D⁺ Solution  | mesotherapy | image, description
  …
  ```

**Phase commit message:** `feat(data): refill missing images/descriptions from secondary source with vision verification`

### Phase 3 — Group display fields and catalog card update

**Goal:** for grouped products, surface a clean group name and a bundle-style image on the deduplicated catalog card. Individual variant pages keep their existing variant-level name and image.

**Data changes (one-shot script):** `scripts/derive-group-display.ts`

For each `groupId` present in `products.json`, compute and persist:
- `groupName` (on every product in the group): a clean, brand-style label. Algorithm:
  1. Take the most common leading uppercase token shared across all variant names in the group. E.g. for `REGENOVUE FINE PLUS (CE)`, `REGENOVUE DEEP (CE)`, ... → `REGENOVUE`.
  2. Title-case it (`Regenovue`).
  3. If the algorithm fails (no shared leading token), fall back to the `groupId` itself, title-cased.
- `groupImage` (on every product in the group): URL or local path to a bundle photo. Priority order:
  1. If a bundle photo was scraped during Phase 2 (e.g. an aesthetics-shop or gofillerss product page shows the variants together), use that — naming convention `public/images/products/group-{groupId}.webp`.
  2. Else fall back to the first variant's confirmed image.

Phase 3 implements the data derivation, plus a minimal Phase-2 hook: when iterating products in `refill-from-secondary.ts`, after a group's variants are settled, look for and fetch a "bundle" image specifically (e.g. a sitemap entry whose slug equals the group's `groupId` rather than a single variant slug). Any candidate bundle shot goes through the same subagent vision verification as variant images; if verified, save as `group-{groupId}.webp`.

**UI changes:** `components/catalogue/ProductCard.tsx`

When the card represents a *group* (i.e. the catalog has deduplicated multiple products to a single card via `groupId`), use `groupName` for the title and `groupImage` for the image instead of `name` and `image`. The "N options" pill stays. Click target stays at the first variant's product page. Non-grouped products are unaffected.

**Phase commit message:** `feat(data,ui): add groupName/groupImage and use them on deduplicated catalog cards`

## Order of operations

```
Phase 1 (audit)  →  commit  →  Phase 2 (refill + missingproducts.txt)  →  commit  →  Phase 3 (group display)  →  commit
```

Each phase is independently runnable and committed. Stopping after Phase 1 leaves the site with cleared slots but no wrong images. Stopping after Phase 2 leaves the site with all available data filled and `missingproducts.txt` produced. Phase 3 is a polish layer on top.

## Configuration

**No new environment variables.** The user has explicitly stated they do not have an `ANTHROPIC_API_KEY`, so all vision verification happens via Claude Code subagent dispatch during plan execution rather than via a paid API key.

**Package additions:** None. The new scripts only need things already in the dependency tree: `axios` (already present), `cheerio` (already present), `sharp` (already present, for any image post-processing).

## Backups and safety

- Each phase reads the current `products.json`, writes a backup to `data/backups/products-{ISO}.json`, then writes the new version. Rollback = `cp data/backups/products-{ISO}.json data/products.json`.
- Phase 1 only clears fields; it never overwrites with new data. Cannot corrupt anything that's already correct.
- Phase 2 stages secondary images in `product-{id}-secondary.webp` until vision approval, then renames. A rejected secondary image is deleted, not promoted.
- Phase 3 derives `groupName`/`groupImage` from current data; rerunning is idempotent.
- Each phase commits separately. `git revert <sha>` rolls back a single phase if needed.

## Testing

No test framework in the project. Verification is:
1. `npm run build` after each phase — `Compiled successfully`, 38 pages.
2. `npm run lint` — no new errors above the pre-Spec-1 baseline of 69 problems.
3. Manual inspection of the three report files (`audit-report.txt`, `refill-report.txt`, `missingproducts.txt`) and spot-check 5–10 entries against the actual images.
4. Dev server: `npm run dev`, navigate to `/en/catalogue/fillers` and confirm the grouped cards show clean group names + bundle photos; individual variant pages show their variant names/images unchanged.

## Risks and open items

- **gofillerss.com structure is unknown.** During plan-writing, a small `WebFetch` reconnaissance will determine sitemap availability. If gofillerss has no usable sitemap, fall back to scraping its category index pages. If gofillerss is completely unusable, the plan will swap in a different secondary source (e.g. `medanat.com` or `kosbeauty.com`) — but this is a plan-level decision, not a spec change.
- **Subagent vision could misclassify.** The audit report exposes every classification with a reason — the user can spot-check. If MISMATCH rate is unexpectedly high (>30%) or CONFIRMED includes obvious wrong matches, the prompt may need tuning. The spec accepts up to one revision pass of the prompt as part of Phase 1.
- **Bundle photos may not exist for every group.** That's fine — `groupImage` falls back to the first variant's image. The site still looks better than today because group *names* are cleaned up.
- **Phase 1 wall time.** ≈ 1 hour for 438 products across ~22 subagent dispatches. This is real session time spent. If the user wants it faster, the batch size can be raised (e.g. 30/dispatch instead of 20) at slight risk of context bloat in the subagent. The plan will set an initial size and call out the adjustment knob.
- **Re-runnability.** Unlike an API-key script, this audit is not a one-command rerun. If the data changes later (new products added, images replaced), re-auditing requires another Claude Code session. Acceptable for a B2B catalog where the product set is largely stable.
