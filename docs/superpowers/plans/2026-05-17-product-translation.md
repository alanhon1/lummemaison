# Product Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translate every product's `description` and `specification` into Russian and Korean via Claude Code subagent dispatch, store the translations in two id-keyed JSON files, and surface them on product cards, product detail pages, and the cart panel through a tiny locale-aware lookup helper.

**Architecture:** Five Node/TypeScript pieces. A prep script splits source text into batches. The translation step is a nested subagent dispatch (no API key, $0). An apply script reshapes results into final `data/translations/{locale}.json` files. Two lookup helpers in `lib/products.ts` (English fallback) consume them. Three display call sites switch from `product.description` / `product.specification` to the helpers.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript 5, next-intl (already wired for en/ru/ko UI strings), `tsx` for scripts. No new dependencies. Verification = `npm run build` + `npm run lint` + manual browser walkthrough across locales.

**Spec:** `docs/superpowers/specs/2026-05-17-product-translation-design.md` (commit `e73c409`)

**Pre-verified facts:**
- 438 products total, 414 with `description` length ≥ 50 chars after Spec 2. Most also carry a short `specification` line.
- `lib/i18n.ts` exports `locales = ['en', 'ru', 'ko']`. `messages/{locale}.json` covers all UI strings.
- Three display call sites use the fields: `components/catalogue/ProductCard.tsx` (specification only, lines 70 and 142), `app/[locale]/product/[id]/page.tsx` (both, lines 111 and 120), `components/layout/CartPanel.tsx` (specification, line 82). CartPanel already has `const locale = useLocale();` (line 12).
- Cart store (`lib/store.ts`) captures `specification` at add-to-cart time. To make the cart panel reactive to locale switching, the panel must look up the live product by `item.id` rather than rely on `item.specification`.

---

## File Structure

**New files:**
- `scripts/translate-prep.ts` — splits source text into translation batches per locale
- `scripts/translate-apply.ts` — merges subagent result files into the final id-keyed shape
- `data/translations/ru.json` — Russian translations (id → {description, specification})
- `data/translations/ko.json` — Korean translations (id → {description, specification})

**Modified files:**
- `lib/products.ts` — adds `getLocalizedDescription()` and `getLocalizedSpecification()`
- `components/catalogue/ProductCard.tsx` — two `specification` references swapped to helper call
- `app/[locale]/product/[id]/page.tsx` — `description` and `specification` references swapped
- `components/layout/CartPanel.tsx` — derives `specification` from live product via helper
- `package.json` — adds `translate-prep` and `translate-apply` npm scripts
- `.gitignore` — adds the working/intermediate dirs

**Intermediate (gitignored, regenerated on each run):**
- `scripts/translate-batches/{locale}/batch-{N}.json` — input batches for vision-style worker dispatch
- `scripts/translate-results/{locale}.json` — accumulated subagent output

---

## Task 1: translate-prep script

**Files:**
- Modify: `.gitignore`
- Create: `scripts/translate-prep.ts`
- Modify: `package.json`

Reads `data/products.json`, walks every product collecting `(id, fieldName, sourceText)` tuples where `sourceText` is non-empty, splits into per-locale batches of 25 tuples each, and writes them to `scripts/translate-batches/{locale}/batch-{N}.json`. Two locales (ru, ko) — separate batch sets so a single locale can be re-run without disturbing the other.

- [ ] **Step 1: Add gitignore entries**

Open `.gitignore` and append at the end (after the Spec 2 entries):

```
# Spec 4 translation intermediates (regenerated on every run)
scripts/translate-batches/
scripts/translate-results/
```

- [ ] **Step 2: Create scripts/translate-prep.ts**

Write to `scripts/translate-prep.ts`:

```ts
/**
 * Splits every product's description + specification into translation
 * batches for ru and ko. Writes scripts/translate-batches/{locale}/batch-{N}.json.
 * Each batch is a JSON array of {id, field, source} tuples where source is
 * the English text the worker subagent will translate.
 */

import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUT_ROOT = path.join(process.cwd(), 'scripts', 'translate-batches');
const LOCALES = ['ru', 'ko'] as const;
const BATCH_SIZE = 25;

interface Product {
  id: number;
  description: string;
  specification: string;
}
interface Tuple {
  id: number;
  field: 'description' | 'specification';
  source: string;
}

function main(): void {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  const tuples: Tuple[] = [];
  for (const p of data.products) {
    if (p.description && p.description.length > 0) {
      tuples.push({ id: p.id, field: 'description', source: p.description });
    }
    if (p.specification && p.specification.length > 0) {
      tuples.push({ id: p.id, field: 'specification', source: p.specification });
    }
  }

  if (fs.existsSync(OUT_ROOT)) {
    fs.rmSync(OUT_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });

  for (const locale of LOCALES) {
    const localeDir = path.join(OUT_ROOT, locale);
    fs.mkdirSync(localeDir, { recursive: true });
    let batchIdx = 0;
    for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
      const batch = tuples.slice(i, i + BATCH_SIZE);
      const outPath = path.join(localeDir, `batch-${batchIdx}.json`);
      fs.writeFileSync(outPath, JSON.stringify(batch, null, 2), 'utf8');
      batchIdx++;
    }
    console.log(`Locale ${locale}: wrote ${batchIdx} batches (${tuples.length} tuples) to ${localeDir}`);
  }
}

main();
```

- [ ] **Step 3: Add the npm script**

Edit `package.json`. Find the `"scripts"` block and add this entry after the existing `"derive-groups"` line:

```json
    "translate-prep": "tsx scripts/translate-prep.ts",
```

- [ ] **Step 4: Run the script and verify**

Run: `npm run translate-prep`
Expected output:

```
Locale ru: wrote ~33 batches (~810 tuples) to <abs>/scripts/translate-batches/ru
Locale ko: wrote ~33 batches (~810 tuples) to <abs>/scripts/translate-batches/ko
```

(Counts approximate — exact numbers depend on how many products still have description/specification after Spec 2.)

Verify:
```bash
ls scripts/translate-batches/ru/ | wc -l
ls scripts/translate-batches/ko/ | wc -l
```
Both should print the same batch count.

Sample one batch:
```bash
node -e "const b=require('./scripts/translate-batches/ru/batch-0.json'); console.log('entries:', b.length); console.log('sample:', JSON.stringify(b[0], null, 2));"
```
Should show 25 entries (or fewer for the last batch), shape `{id, field, source}`.

- [ ] **Step 5: Commit**

```
git add .gitignore scripts/translate-prep.ts package.json
git commit -m "feat(scripts): translate-prep splits products into per-locale batches"
```

(The `scripts/translate-batches/` directory itself is gitignored, so it won't be committed.)

---

## Task 2: Translation dispatch (nested subagent orchestration)

**Files:**
- Create: `scripts/translate-results/ru.json` (output, gitignored)
- Create: `scripts/translate-results/ko.json` (output, gitignored)

Same pattern as Spec 2's vision audit task. The implementer subagent for this task does NOT write code itself — it orchestrates ~66 sub-subagent dispatches (33 per locale) that each translate one batch and return JSON.

**Wall time expectation:** ~66 subagent dispatches × ~3 minutes each = 3-5 hours. Run when ready to leave it running.

- [ ] **Step 1: List the batch files**

Run: `ls scripts/translate-batches/ru/` and `ls scripts/translate-batches/ko/`
Note the count per locale (should match).

- [ ] **Step 2: Initialize the two result files**

Create `scripts/translate-results/` directory if missing. Initialize both result files as empty arrays:

```bash
mkdir -p scripts/translate-results
node -e "require('fs').writeFileSync('scripts/translate-results/ru.json', '[]')"
node -e "require('fs').writeFileSync('scripts/translate-results/ko.json', '[]')"
```

- [ ] **Step 3: For each locale, for each batch, dispatch a translation worker subagent**

For `locale` in `['ru', 'ko']`:
  For `batch_idx` in `0..N-1` (where N is the batch count from Step 1):
    Use the Agent tool with these parameters:
    - `description`: "Spec4 translate {locale} batch {N}"
    - `subagent_type`: "general-purpose"
    - `model`: "sonnet"
    - `prompt`: see template below

Sequential dispatch — one at a time. After each returns, parse the JSON array, validate the shape, and append to `scripts/translate-results/{locale}.json` (write the full updated array each time so progress is durable).

**Translation worker prompt template** (substitute `{LOCALE}` with `Russian` or `Korean`, `{LOCALE_CODE}` with `ru` or `ko`, `{N}` with the batch index):

```
You are translating Korean cosmetic and aesthetic product text from English to {LOCALE} for the Lumière B2B catalogue.

Working directory: C:\Users\user\Desktop\lumiere-app

Open the file `scripts/translate-batches/{LOCALE_CODE}/batch-{N}.json` using the Read tool. It contains a JSON array of objects shaped:
{
  "id": <product id>,
  "field": "description" | "specification",
  "source": "<English source text>"
}

For EACH entry:
1. Translate the `source` text into natural, professional {LOCALE} suitable for a B2B wholesale buyer.
2. Preserve as-is (do NOT translate): brand names (BARBIE SLIM, REGENOVUE, BOTULAX, NEURAMIS, etc.), dosages (10 mL, 100 IU, 200 mg, etc.), technical abbreviations (HA, PDLLA, PDRN, PN, PLLA), volume/quantity notations (x 5 vials, 1 mL syringe).
3. Use a polished marketing tone — these are luxury Korean aesthetic medical products. Avoid stiff literal translations.
4. Keep the translation length roughly proportional to the source (within ±50%). Specifications should stay terse.

Return ONLY a JSON array with the SAME LENGTH and ORDER as the input. Each element shaped:
{
  "id": <number>,
  "field": "description" | "specification",
  "translated": "<your translation>"
}

No markdown fences, no commentary outside the JSON.
```

- [ ] **Step 4: After all batches per locale, validate the result**

After all batches complete for a given locale, run:

```bash
node -e "const r=require('./scripts/translate-results/ru.json'); console.log('ru total:', r.length); console.log('ru with translation:', r.filter(x=>x.translated && x.translated.length>0).length);"
node -e "const r=require('./scripts/translate-results/ko.json'); console.log('ko total:', r.length); console.log('ko with translation:', r.filter(x=>x.translated && x.translated.length>0).length);"
```

Both totals should match the tuple count from Task 1 (~810 each). The "with translation" count should equal the total — any missing entries indicate a subagent dropped data; re-dispatch the affected batches.

If validation passes, no commit needed — these files are gitignored intermediates. The final translation files are produced in Task 3.

- [ ] **Step 5: Status report back to controller**

Report:
- Total translations per locale (should be ~810 each)
- Any batches that needed retry
- Any quality concerns (sample 3-5 translations and read them for naturalness — flag if any look broken or untranslated)

---

## Task 3: translate-apply script

**Files:**
- Create: `scripts/translate-apply.ts`
- Modify: `package.json`
- Create: `data/translations/ru.json`
- Create: `data/translations/ko.json`

Reshapes `scripts/translate-results/{locale}.json` (flat array of tuples) into `data/translations/{locale}.json` (id-keyed object with `description` and `specification` per product).

- [ ] **Step 1: Create scripts/translate-apply.ts**

Write to `scripts/translate-apply.ts`:

```ts
/**
 * Reshapes scripts/translate-results/{locale}.json (flat tuple array) into
 * data/translations/{locale}.json (id-keyed object), one file per locale.
 * Final shape:
 *   { "<productId>": { "description": "...", "specification": "..." } }
 */

import fs from 'fs';
import path from 'path';

const RESULTS_ROOT = path.join(process.cwd(), 'scripts', 'translate-results');
const OUT_ROOT = path.join(process.cwd(), 'data', 'translations');
const LOCALES = ['ru', 'ko'] as const;

interface Tuple {
  id: number;
  field: 'description' | 'specification';
  translated: string;
}
type Translations = Record<string, { description?: string; specification?: string }>;

function readJson<T>(file: string): T {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  return JSON.parse(raw);
}

function main(): void {
  if (!fs.existsSync(OUT_ROOT)) fs.mkdirSync(OUT_ROOT, { recursive: true });

  for (const locale of LOCALES) {
    const inFile = path.join(RESULTS_ROOT, `${locale}.json`);
    if (!fs.existsSync(inFile)) {
      console.error(`Missing ${inFile}`);
      process.exit(1);
    }
    const tuples = readJson<Tuple[]>(inFile);
    const grouped: Translations = {};
    for (const t of tuples) {
      if (!t.translated || t.translated.length === 0) continue;
      const key = String(t.id);
      if (!grouped[key]) grouped[key] = {};
      grouped[key][t.field] = t.translated;
    }
    const outFile = path.join(OUT_ROOT, `${locale}.json`);
    fs.writeFileSync(outFile, JSON.stringify(grouped, null, 2), 'utf8');
    console.log(`Wrote ${Object.keys(grouped).length} product entries to ${outFile}`);
  }
}

main();
```

- [ ] **Step 2: Add the npm script**

Edit `package.json`, add after `translate-prep`:

```json
    "translate-apply": "tsx scripts/translate-apply.ts",
```

- [ ] **Step 3: Run the script**

Run: `npm run translate-apply`
Expected output (counts approximate):
```
Wrote ~414 product entries to <abs>/data/translations/ru.json
Wrote ~414 product entries to <abs>/data/translations/ko.json
```

Verify:
```bash
node -e "const r=require('./data/translations/ru.json'); const keys=Object.keys(r); console.log('ru products:', keys.length); console.log('sample (id 1):', JSON.stringify(r['1'], null, 2));"
node -e "const r=require('./data/translations/ko.json'); const keys=Object.keys(r); console.log('ko products:', keys.length); console.log('sample (id 1):', JSON.stringify(r['1'], null, 2));"
```

Both should show the same count and product id `1` should have at least a description (and probably a specification) in the target language.

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages. (The new files exist but aren't yet imported by app code.)

- [ ] **Step 5: Commit**

```
git add scripts/translate-apply.ts package.json data/translations/ru.json data/translations/ko.json
git commit -m "feat(data): apply translations to data/translations/{ru,ko}.json"
```

---

## Task 4: Lookup helpers in lib/products.ts

**Files:**
- Modify: `lib/products.ts`

Adds two functions that resolve to the locale-specific translation if present, otherwise fall back to the English source.

- [ ] **Step 1: Add imports and TRANSLATIONS map at the top of lib/products.ts**

Open `lib/products.ts`. After the existing `import productsData from '@/data/products.json';` line, add the two translation imports and the lookup map. The current top of the file looks like:

```ts
import productsData from '@/data/products.json';

export interface Category {
```

Replace with:

```ts
import productsData from '@/data/products.json';
import translationsRu from '@/data/translations/ru.json';
import translationsKo from '@/data/translations/ko.json';

type ProductTranslation = { description?: string; specification?: string };

const TRANSLATIONS: Record<string, Record<string, ProductTranslation>> = {
  ru: translationsRu as Record<string, ProductTranslation>,
  ko: translationsKo as Record<string, ProductTranslation>,
};

export interface Category {
```

- [ ] **Step 2: Add the two helper functions at the bottom of lib/products.ts**

After the last existing function (`getProductVariants` at the end of the file), append:

```ts

export function getLocalizedDescription(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.description;
  return t || product.description;
}

export function getLocalizedSpecification(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale]?.[String(product.id)]?.specification;
  return t || product.specification;
}
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages. The helpers are not yet used but the imports must type-check.

- [ ] **Step 4: Commit**

```
git add lib/products.ts
git commit -m "feat(products): add getLocalizedDescription and getLocalizedSpecification helpers"
```

---

## Task 5: Wire up the three display call sites

**Files:**
- Modify: `components/catalogue/ProductCard.tsx`
- Modify: `app/[locale]/product/[id]/page.tsx`
- Modify: `components/layout/CartPanel.tsx`

Three small edits, one per file, each swapping a direct property access for a helper call. Bundled in one commit because all three are mechanical and trivially small.

- [ ] **Step 1: Update components/catalogue/ProductCard.tsx**

Open `components/catalogue/ProductCard.tsx`. The current imports include `useLocale` and `Product`. Add the helper to the existing import from `@/lib/products`:

Find:
```tsx
import type { Product } from '@/lib/products';
```

Replace with:
```tsx
import { getLocalizedSpecification, type Product } from '@/lib/products';
```

In the LIST layout, find this line (around line 70):

```tsx
                <p className="text-xs text-mist mt-1 line-clamp-1">{product.specification}</p>
```

Replace with:

```tsx
                <p className="text-xs text-mist mt-1 line-clamp-1">{getLocalizedSpecification(product, locale)}</p>
```

In the GRID layout, find this line (around line 142):

```tsx
        {product.specification && (
          <p className="text-xs text-mist line-clamp-1 mb-3">{product.specification}</p>
        )}
```

Replace with:

```tsx
        {product.specification && (
          <p className="text-xs text-mist line-clamp-1 mb-3">{getLocalizedSpecification(product, locale)}</p>
        )}
```

(The `product.specification &&` guard stays — we use English presence as the gate, then localize the displayed text.)

- [ ] **Step 2: Update app/[locale]/product/[id]/page.tsx**

Open `app/[locale]/product/[id]/page.tsx`. Add the helpers to the existing import from `@/lib/products`. Find:

```tsx
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants, categories } from '@/lib/products';
```

Replace with:

```tsx
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants, getLocalizedDescription, getLocalizedSpecification, categories } from '@/lib/products';
```

Find the specification render (around line 111):

```tsx
                <p className="text-sm text-charcoal leading-relaxed">{product.specification}</p>
```

Replace with:

```tsx
                <p className="text-sm text-charcoal leading-relaxed">{getLocalizedSpecification(product, locale)}</p>
```

Find the description render (around line 120):

```tsx
                <p className="text-sm text-charcoal leading-relaxed">{product.description}</p>
```

Replace with:

```tsx
                <p className="text-sm text-charcoal leading-relaxed">{getLocalizedDescription(product, locale)}</p>
```

- [ ] **Step 3: Update components/layout/CartPanel.tsx**

Open `components/layout/CartPanel.tsx`. It already imports `useLocale` (line 4) and stores the locale (line 12). It does NOT currently import from `@/lib/products` — add an import.

After the existing imports at the top, add:

```tsx
import { getProductById, getLocalizedSpecification } from '@/lib/products';
```

Find the specification render (around line 81-83):

```tsx
                    {item.specification && (
                      <p className="text-xs text-mist line-clamp-1">{item.specification}</p>
                    )}
```

Replace with a live lookup that re-derives the specification from the current product data at render time (so locale switching updates the cart):

```tsx
                    {(() => {
                      const liveProduct = getProductById(item.id);
                      const spec = liveProduct ? getLocalizedSpecification(liveProduct, locale) : item.specification;
                      return spec ? (
                        <p className="text-xs text-mist line-clamp-1">{spec}</p>
                      ) : null;
                    })()}
```

(IIFE keeps the logic inline without restructuring the surrounding JSX. The fallback to `item.specification` covers the edge case of a cart item whose product is no longer in the catalogue.)

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages.

- [ ] **Step 5: Commit**

```
git add components/catalogue/ProductCard.tsx app/[locale]/product/[id]/page.tsx components/layout/CartPanel.tsx
git commit -m "feat(ui): use localized description and specification across catalog, detail, cart"
```

---

## Task 6: Final verification

**Files:** none modified.

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: `Compiled successfully`, all 38 pages.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: problem count at or below pre-Spec-4 baseline of 69. No new errors.

- [ ] **Step 3: End-to-end manual walkthrough**

Start dev server: `npm run dev`. On `http://localhost:3000`:

1. **English baseline** — `/en/catalogue` shows specifications under each product card in English. Click any product — description and specification render in English. Add to cart — cart panel shows the same English spec.
2. **Switch to Korean** — click `KO` in header. URL becomes `/ko/catalogue`. Same product cards now show Korean specifications. Click the same product — description and specification render in Korean.
3. **Cart locale reactivity** — keep an item in cart. Switch from KO to EN. Open cart panel. The cart item's spec line is now in English. Switch to RU — same item's spec is now in Russian.
4. **Switch to Russian** — `/ru/catalogue`. Product cards show Russian specifications. Detail page renders Russian description.
5. **Fallback edge case** — pick a product whose English description is empty (any in `public/missingproducts.txt`). On RU and KO, the description section should be hidden (because the English fallback is also empty — the helper returns `''` which is falsy).
6. **Spot-check translation quality** — read 5 product descriptions in Korean and 5 in Russian. Confirm:
   - Brand names preserved (REGENOVUE, BARBIE SLIM, etc.)
   - Dosages preserved (10 mL, etc.)
   - Reads naturally, not literal/awkward

- [ ] **Step 4: Final git log**

Run: `git log --oneline e73c409..HEAD`

Expected 5 implementation commits + spec commit:
```
<sha> feat(ui): use localized description and specification across catalog, detail, cart
<sha> feat(products): add getLocalizedDescription and getLocalizedSpecification helpers
<sha> feat(data): apply translations to data/translations/{ru,ko}.json
<sha> feat(scripts): translate-prep splits products into per-locale batches
e73c409 docs: spec for product description+specification translation (Spec 4/4)
```

(Task 2 produces no commit — translation results are gitignored intermediates.)

No commit for this task — verification gate only.

---

## Done criteria

- [ ] All 6 tasks complete with green build and lint.
- [ ] `data/translations/ru.json` and `data/translations/ko.json` each contain ~400+ product entries.
- [ ] Switching locale on a product detail page changes the visible description and specification text.
- [ ] Cart panel updates the spec line when locale changes (without needing to re-add items).
- [ ] English remains the fallback for any locale or any missing translation entry — no broken empty text anywhere.
- [ ] Brand names (REGENOVUE, BARBIE SLIM, BOTULAX, etc.) preserved untranslated in all locales.
