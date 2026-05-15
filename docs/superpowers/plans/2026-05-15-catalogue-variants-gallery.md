# Catalogue Variants, Gallery & Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Lumière catalogue so variant products (SOSUM S/M/H) are grouped under one card with a "Choose an option" selector, each product detail page shows a 2–4 image gallery, and descriptions are populated from aesthetics-shop.com.

**Architecture:** Approach A — keep all existing product IDs and `/product/[id]` URLs. Add four optional fields (`groupId`, `variantLabel`, `images[]`, `description` already exists) to products in `data/products.json` via one-shot scripts. The catalogue deduplicates by `groupId`; the product detail page detects siblings and renders a variant dropdown + image gallery.

**Tech Stack:** Next.js 16, TypeScript, axios, cheerio, sharp, Tailwind CSS, Framer Motion (already installed)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/products.ts` | Modify | Add `groupId`, `variantLabel`, `images` to `Product` type; add `getProductVariants()` |
| `scripts/group-products.ts` | Create | One-shot: match products to aesthetics-shop.com slugs, assign groupId + variantLabel |
| `scripts/scrape-descriptions.ts` | Create | One-shot: fetch aesthetics-shop.com pages, write descriptions to products.json |
| `scripts/scrape-gallery-images.ts` | Create | One-shot: download 2–4 gallery images per group, write `images[]` |
| `components/catalogue/ProductGallery.tsx` | Create | Main image + thumbnail strip; clicking thumb swaps main |
| `components/catalogue/VariantSelector.tsx` | Create | Styled `<select>` showing variant labels + prices; selecting navigates |
| `components/catalogue/CatalogueClient.tsx` | Modify | Deduplicate grouped products; show one card per group |
| `components/catalogue/ProductCard.tsx` | Modify | "N options" pill when product has siblings |
| `app/[locale]/product/[id]/page.tsx` | Modify | Wire up ProductGallery + VariantSelector + load sibling variants |
| `package.json` | Modify | Add `group-products`, `scrape-descriptions`, `scrape-gallery` npm scripts |

---

## Task 1: Extend Product type + add getProductVariants helper

**Files:**
- Modify: `lib/products.ts`

- [ ] **Step 1: Update Product interface**

Replace the existing `Product` interface in `lib/products.ts` with:

```ts
export interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  description: string;
  price: number;
  tags: string[];
  isNew: boolean;
  isSale: boolean;
  isBestSeller: boolean;
  inStock: boolean;
  image: string;
  moq: number;
  enrichedInfo?: EnrichedInfo;
  // variant fields
  groupId?: string;
  variantLabel?: string;
  images?: string[];
}
```

- [ ] **Step 2: Add getProductVariants helper**

Append to `lib/products.ts` after the existing helper functions:

```ts
export function getProductVariants(groupId: string): Product[] {
  return products.filter(p => p.groupId === groupId).sort((a, b) => a.id - b.id);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors relating to Product type

- [ ] **Step 4: Commit**

```bash
git add lib/products.ts
git commit -m "feat: extend Product type with groupId, variantLabel, images fields"
```

---

## Task 2: Create group-products.ts script

**Files:**
- Create: `scripts/group-products.ts`

This script fetches the aesthetics-shop.com sitemap, scores each of our products against it, finds products that share the same best-matching slug, and writes `groupId` + `variantLabel` back to `data/products.json`.

- [ ] **Step 1: Create the script**

Create `scripts/group-products.ts`:

```ts
/**
 * Groups variant products by their shared aesthetics-shop.com slug.
 *
 * Usage:
 *   npx tsx scripts/group-products.ts
 *
 * Writes groupId + variantLabel to data/products.json for products
 * where 2+ of our items map to the same aesthetics-shop.com product.
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const SITEMAP_URL = 'https://aesthetics-shop.com/product-sitemap.xml';
const MIN_SCORE = 2; // minimum word-overlap score to consider a match valid

interface AestheticsProduct {
  slug: string;
  name: string;
}

interface Product {
  id: number;
  name: string;
  groupId?: string;
  variantLabel?: string;
}

function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(\d+)\s*u\b/g, '$1')
    .replace(/\bunits?\b/g, '')
    .replace(/\bwith\b/g, '')
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = b.split(' ').filter(w => w.length > 1);
  let score = 0;
  for (const w of wb) {
    if (wa.has(w)) score += w.length > 3 ? 2 : 1;
  }
  return score;
}

function extractVariantLabel(productName: string, allNamesInGroup: string[]): string {
  const words = productName.trim().toUpperCase().split(/\s+/);
  const commonWords = new Set(
    words.filter(w => allNamesInGroup.every(n => n.toUpperCase().split(/\s+/).includes(w)))
  );
  const unique = words.filter(w => !commonWords.has(w));
  return unique.join(' ') || productName.trim();
}

async function fetchSitemap(): Promise<AestheticsProduct[]> {
  console.log('Fetching sitemap…');
  const res = await axios.get<string>(SITEMAP_URL, { timeout: 30_000 });
  const xml = res.data;
  const products: AestheticsProduct[] = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

  for (const block of urlBlocks) {
    const locMatch = block.match(/<loc>(?:<!\[CDATA\[)?(https:\/\/aesthetics-shop\.com\/product\/([^\]<]+?)\/??)(?:\]\]>)?<\/loc>/);
    if (!locMatch) continue;
    const slug = locMatch[2].replace(/\/$/, '');
    products.push({ slug, name: slug.replace(/-/g, ' ') });
  }

  console.log(`Parsed ${products.length} products from sitemap.`);
  return products;
}

async function main() {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allProducts = data.products;

  let aestheticsProducts: AestheticsProduct[];
  try {
    aestheticsProducts = await fetchSitemap();
  } catch (err) {
    console.error('Failed to fetch sitemap:', err);
    process.exit(1);
  }

  const normMap = aestheticsProducts.map(p => ({ norm: normalise(p.name), slug: p.slug }));

  // Map each product to its best-matching aesthetics-shop.com slug
  const slugForProduct = new Map<number, string>();
  for (const p of allProducts) {
    const normName = normalise(p.name);
    const scored = normMap
      .map(({ norm, slug }) => ({ score: scoreMatch(normName, norm), slug }))
      .filter(x => x.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      slugForProduct.set(p.id, scored[0].slug);
    }
  }

  // Group products by their matched slug
  const slugToIds = new Map<string, number[]>();
  for (const [id, slug] of slugForProduct) {
    const list = slugToIds.get(slug) ?? [];
    list.push(id);
    slugToIds.set(slug, list);
  }

  // Only groups with 2+ members become variant groups
  let groupCount = 0;
  let variantProductCount = 0;

  for (const [slug, ids] of slugToIds) {
    if (ids.length < 2) continue;

    groupCount++;
    const groupMembers = allProducts.filter(p => ids.includes(p.id));
    const groupNames = groupMembers.map(p => p.name);

    for (const p of groupMembers) {
      const idx = allProducts.findIndex(x => x.id === p.id);
      allProducts[idx].groupId = slug;
      allProducts[idx].variantLabel = extractVariantLabel(p.name, groupNames);
      variantProductCount++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDone. ${groupCount} groups found, ${variantProductCount} products assigned groupId.`);
  console.log('Sample groups:');
  let shown = 0;
  for (const [slug, ids] of slugToIds) {
    if (ids.length < 2 || shown >= 5) continue;
    const names = allProducts.filter(p => ids.includes(p.id)).map(p => `${p.name} → "${p.variantLabel}"`);
    console.log(`  [${slug}]: ${names.join(', ')}`);
    shown++;
  }
}

main();
```

- [ ] **Step 2: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"group-products": "tsx scripts/group-products.ts"
```

- [ ] **Step 3: Run the script**

```bash
npm run group-products
```

Expected output: something like:
```
Fetching sitemap…
Parsed 450 products from sitemap.
Done. 45 groups found, 130 products assigned groupId.
Sample groups:
  [sosum]: SOSUM S → "S", SOSUM M → "M", SOSUM H → "H"
  [botulax]: BOTULAX 100U → "100U", BOTULAX 200U → "200U"
```

- [ ] **Step 4: Verify products.json updated correctly**

Open `data/products.json` and spot-check 2–3 grouped products.
Confirm `groupId` is set and `variantLabel` looks sensible (e.g., "S", "M", "H" not "SOSUM S", "SOSUM M").

- [ ] **Step 5: Commit**

```bash
git add scripts/group-products.ts package.json data/products.json
git commit -m "feat: add group-products script, populate groupId/variantLabel in products.json"
```

---

## Task 3: Create scrape-descriptions.ts script

**Files:**
- Create: `scripts/scrape-descriptions.ts`

- [ ] **Step 1: Create the script**

Create `scripts/scrape-descriptions.ts`:

```ts
/**
 * Scrapes short product descriptions from aesthetics-shop.com and writes
 * them to data/products.json.
 *
 * Only processes products that have a groupId (matched to aesthetics-shop.com).
 * All products in the same group receive the same description.
 *
 * Usage:
 *   npx tsx scripts/scrape-descriptions.ts
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const REPORT_FILE = path.join(process.cwd(), 'scripts', 'descriptions-report.txt');
const DELAY_MS = 1500; // polite crawl delay

interface Product {
  id: number;
  name: string;
  groupId?: string;
  description: string;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchDescription(slug: string): Promise<string | null> {
  const url = `https://aesthetics-shop.com/product/${slug}/`;
  try {
    const res = await axios.get<string>(url, {
      timeout: 30_000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
    });
    const $ = cheerio.load(res.data);

    // WooCommerce short description
    const short = $('.woocommerce-product-details__short-description').text().trim();
    if (short.length > 10) return short.slice(0, 300).trim();

    // Fallback: first paragraph in product summary
    const para = $('.entry-summary p').first().text().trim();
    if (para.length > 10) return para.slice(0, 300).trim();

    // Fallback: product description tab
    const desc = $('.woocommerce-product-details__description p').first().text().trim();
    if (desc.length > 10) return desc.slice(0, 300).trim();

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allProducts = data.products;

  // Build set of unique slugs that need descriptions
  const slugSet = new Set<string>();
  for (const p of allProducts) {
    if (p.groupId) slugSet.add(p.groupId);
  }

  // Also include unmatched products with no description yet — they may still
  // have been image-matched with a known slug stored elsewhere. Skip them
  // here; only groupId-matched products get auto-descriptions.

  const slugs = Array.from(slugSet);
  console.log(`Fetching descriptions for ${slugs.length} unique slugs…`);

  const descMap = new Map<string, string>();
  const failed: string[] = [];
  const succeeded: string[] = [];

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    process.stdout.write(`[${i + 1}/${slugs.length}] ${slug}… `);
    const desc = await fetchDescription(slug);
    if (desc) {
      descMap.set(slug, desc);
      process.stdout.write(`✓ (${desc.length} chars)\n`);
      succeeded.push(slug);
    } else {
      process.stdout.write('✗ not found\n');
      failed.push(slug);
    }
    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  // Write descriptions to all products in each group
  let updated = 0;
  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    if (p.groupId && descMap.has(p.groupId)) {
      allProducts[i].description = descMap.get(p.groupId)!;
      updated++;
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');

  const report = [
    `=== DESCRIPTIONS FETCHED (${succeeded.length}) ===`,
    ...succeeded,
    '',
    `=== FAILED (${failed.length}) ===`,
    ...failed,
  ].join('\n');
  fs.writeFileSync(REPORT_FILE, report, 'utf8');

  console.log(`\nDone. Updated ${updated} products. Report: scripts/descriptions-report.txt`);
}

main();
```

- [ ] **Step 2: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"scrape-descriptions": "tsx scripts/scrape-descriptions.ts"
```

- [ ] **Step 3: Run the script**

```bash
npm run scrape-descriptions
```

Expected: progress log for each slug, then a summary. Takes ~2–5 minutes (1.5s delay between requests).

- [ ] **Step 4: Spot-check**

Open `data/products.json` and verify a few grouped products have non-empty `description` values.

- [ ] **Step 5: Commit**

```bash
git add scripts/scrape-descriptions.ts package.json data/products.json scripts/descriptions-report.txt
git commit -m "feat: add scrape-descriptions script, populate descriptions from aesthetics-shop.com"
```

---

## Task 4: Create scrape-gallery-images.ts script

**Files:**
- Create: `scripts/scrape-gallery-images.ts`

- [ ] **Step 1: Create the script**

Create `scripts/scrape-gallery-images.ts`:

```ts
/**
 * Scrapes gallery images from aesthetics-shop.com product pages and saves
 * them locally. Writes the `images` array to data/products.json.
 *
 * For each group, fetches up to 3 extra images (beyond the main image).
 * All products in the group share the same images[] array.
 *
 * Usage:
 *   npx tsx scripts/scrape-gallery-images.ts          # skip groups with existing images
 *   npx tsx scripts/scrape-gallery-images.ts --force  # overwrite all
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';
import * as cheerio from 'cheerio';

const DATA_FILE = path.join(process.cwd(), 'data', 'products.json');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'products');
const FORCE = process.argv.includes('--force');
const DELAY_MS = 1500;
const MAX_EXTRA_IMAGES = 3;

interface Product {
  id: number;
  name: string;
  image: string;
  groupId?: string;
  images?: string[];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeGalleryUrls(slug: string): Promise<string[]> {
  const url = `https://aesthetics-shop.com/product/${slug}/`;
  const res = await axios.get<string>(url, {
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LumiereBot/1.0)' },
  });
  const $ = cheerio.load(res.data);

  const urls: string[] = [];
  // WooCommerce gallery thumbnails store full image URL in data-large_image
  $('.woocommerce-product-gallery__image a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.startsWith('http') && !urls.includes(href)) {
      urls.push(href);
    }
  });

  // Fallback: og:image and og:image variants
  if (urls.length === 0) {
    $('meta[property^="og:image"]').each((_, el) => {
      const content = $(el).attr('content');
      if (content && content.startsWith('http') && !urls.includes(content)) {
        urls.push(content);
      }
    });
  }

  return urls;
}

async function downloadImage(imageUrl: string, destPath: string): Promise<void> {
  const res = await axios.get<ArrayBuffer>(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30_000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const buf = Buffer.from(res.data);
  await sharp(buf)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toFile(destPath);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const data: { products: Product[] } = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const allProducts = data.products;

  // Find the primary product (lowest id) for each group
  const groupPrimaries = new Map<string, Product>();
  for (const p of allProducts) {
    if (!p.groupId) continue;
    const existing = groupPrimaries.get(p.groupId);
    if (!existing || p.id < existing.id) {
      groupPrimaries.set(p.groupId, p);
    }
  }

  const slugs = Array.from(groupPrimaries.keys());
  console.log(`Processing ${slugs.length} groups…`);

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i];
    const primary = groupPrimaries.get(slug)!;
    const prefix = `[${i + 1}/${slugs.length}] ${slug}`;

    // Skip if already has extra images and not forcing
    if (!FORCE && primary.images && primary.images.length > 0) {
      process.stdout.write(`${prefix} — skipped (has images)\n`);
      continue;
    }

    let galleryUrls: string[];
    try {
      galleryUrls = await scrapeGalleryUrls(slug);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`${prefix} ✗ fetch error: ${msg}\n`);
      continue;
    }

    // Skip the first URL if it matches the already-downloaded main image
    // (aesthetics-shop.com gallery[0] is usually the same as sitemap image)
    // Download extra images starting from index 1
    const extraUrls = galleryUrls.slice(1, 1 + MAX_EXTRA_IMAGES);

    if (extraUrls.length === 0) {
      process.stdout.write(`${prefix} — no extra images found\n`);
      continue;
    }

    const savedPaths: string[] = [];
    for (let j = 0; j < extraUrls.length; j++) {
      const destPath = path.join(OUTPUT_DIR, `product-${primary.id}-${j + 2}.webp`);
      try {
        await downloadImage(extraUrls[j], destPath);
        savedPaths.push(`/images/products/product-${primary.id}-${j + 2}.webp`);
      } catch {
        // Skip failed images silently
      }
    }

    if (savedPaths.length === 0) {
      process.stdout.write(`${prefix} — download failed\n`);
      continue;
    }

    // Write images[] to ALL products in this group
    for (let k = 0; k < allProducts.length; k++) {
      if (allProducts[k].groupId === slug) {
        allProducts[k].images = savedPaths;
      }
    }

    process.stdout.write(`${prefix} ✓ ${savedPaths.length} extra images\n`);

    // Save progress every 10 groups
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    }

    if (i < slugs.length - 1) await sleep(DELAY_MS);
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  console.log('\nDone.');
}

main();
```

- [ ] **Step 2: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"scrape-gallery": "tsx scripts/scrape-gallery-images.ts"
```

- [ ] **Step 3: Run the script**

```bash
npm run scrape-gallery
```

Expected: progress log. Takes ~3–8 minutes depending on number of groups.

- [ ] **Step 4: Spot-check**

Verify that `public/images/products/` contains files like `product-45-2.webp`, `product-45-3.webp`, and that a few products in `data/products.json` now have `"images": [...]`.

- [ ] **Step 5: Commit**

```bash
git add scripts/scrape-gallery-images.ts package.json data/products.json
git commit -m "feat: add scrape-gallery-images script, populate images[] in products.json"
```

---

## Task 5: Create ProductGallery component

**Files:**
- Create: `components/catalogue/ProductGallery.tsx`

- [ ] **Step 1: Create the component**

Create `components/catalogue/ProductGallery.tsx`:

```tsx
'use client';

import { useState } from 'react';
import ProductImage from './ProductImage';

interface ProductGalleryProps {
  mainImage: string;
  extraImages: string[];
  alt: string;
  productId: number;
  categoryId: string;
  categoryName?: string;
  badges?: React.ReactNode;
}

export default function ProductGallery({
  mainImage,
  extraImages,
  alt,
  productId,
  categoryId,
  categoryName,
  badges,
}: ProductGalleryProps) {
  const allImages = [mainImage, ...extraImages].filter(Boolean);
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div className="lg:sticky lg:top-28">
      {/* Main image */}
      <div className="border border-bone aspect-square relative overflow-hidden">
        <ProductImage
          src={allImages[activeIdx] ?? mainImage}
          alt={alt}
          productId={productId}
          categoryId={categoryId}
          categoryName={categoryName}
          fill={false}
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        {badges && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {badges}
          </div>
        )}
      </div>

      {/* Thumbnails — only shown when there are extra images */}
      {allImages.length > 1 && (
        <div className="flex gap-2 mt-3">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-16 h-16 border relative overflow-hidden flex-shrink-0 transition-all duration-200 ${
                activeIdx === i
                  ? 'border-gold'
                  : 'border-bone hover:border-gold/50'
              }`}
            >
              <ProductImage
                src={img}
                alt={`${alt} view ${i + 1}`}
                productId={productId}
                categoryId={categoryId}
                fill={false}
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/catalogue/ProductGallery.tsx
git commit -m "feat: add ProductGallery component with thumbnail strip"
```

---

## Task 6: Create VariantSelector component

**Files:**
- Create: `components/catalogue/VariantSelector.tsx`

- [ ] **Step 1: Create the component**

Create `components/catalogue/VariantSelector.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import type { Product } from '@/lib/products';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';

interface VariantSelectorProps {
  currentProduct: Product;
  variants: Product[];
}

export default function VariantSelector({ currentProduct, variants }: VariantSelectorProps) {
  const router = useRouter();
  const locale = useLocale();
  const { currency } = useCurrencyStore();

  if (variants.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = parseInt(e.target.value);
    if (!isNaN(id) && id !== currentProduct.id) {
      router.push(`/${locale}/product/${id}`);
    }
  }

  return (
    <div className="mb-6">
      <label className="block text-xs font-semibold tracking-wider uppercase text-mist mb-2">
        Choose an option
      </label>
      <div className="relative">
        <select
          value={currentProduct.id}
          onChange={handleChange}
          className="w-full border border-bone px-4 py-3 text-sm text-charcoal bg-white outline-none hover:border-gold focus:border-gold transition-colors appearance-none cursor-pointer"
        >
          {variants.map(v => (
            <option key={v.id} value={v.id}>
              {v.variantLabel || v.name}
              {v.price !== currentProduct.price ? ` — ${formatPrice(v.price, currency)}` : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-mist"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/catalogue/VariantSelector.tsx
git commit -m "feat: add VariantSelector component"
```

---

## Task 7: Update CatalogueClient — deduplicate grouped products

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

The catalogue should show one card per group (the representative with lowest id). When a user searches "SOSUM", they see one card for the SOSUM group.

- [ ] **Step 1: Add deduplication to filteredProducts useMemo**

In `components/catalogue/CatalogueClient.tsx`, locate the `filteredProducts` useMemo. After the sort step and before `return result`, add:

```ts
// Deduplicate grouped products: keep only the lowest-id representative per group
const seenGroups = new Set<string>();
result = result.filter(p => {
  if (!p.groupId) return true;
  if (seenGroups.has(p.groupId)) return false;
  seenGroups.add(p.groupId);
  return true;
});
```

The complete useMemo should look like:

```ts
const filteredProducts = useMemo(() => {
  let result: Product[] = products;

  if (searchQuery.trim()) {
    result = fuse.search(searchQuery).map(r => r.item);
  }

  if (activeCategory) {
    result = result.filter(p => p.categoryId === activeCategory);
  }

  if (saleOnly) {
    result = result.filter(p => p.isSale);
  }

  if (newOnly) {
    result = result.filter(p => p.isNew);
  }

  switch (sortBy) {
    case 'price-asc':
      result = [...result].sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      result = [...result].sort((a, b) => b.price - a.price);
      break;
    case 'name':
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  // Deduplicate grouped products: keep only the lowest-id representative per group
  const seenGroups = new Set<string>();
  result = result.filter(p => {
    if (!p.groupId) return true;
    if (seenGroups.has(p.groupId)) return false;
    seenGroups.add(p.groupId);
    return true;
  });

  return result;
}, [searchQuery, activeCategory, saleOnly, newOnly, sortBy, fuse]);
```

- [ ] **Step 2: Precompute variant counts map**

Add this above the `filteredProducts` useMemo:

```ts
const variantCounts = useMemo(() => {
  const map = new Map<string, number>();
  for (const p of products) {
    if (p.groupId) {
      map.set(p.groupId, (map.get(p.groupId) ?? 0) + 1);
    }
  }
  return map;
}, []);
```

- [ ] **Step 3: Pass variantCount to ProductCard**

In the grid rendering section, change:
```tsx
<ProductCard key={product.id} product={product} layout="grid" />
```
to:
```tsx
<ProductCard
  key={product.id}
  product={product}
  layout="grid"
  variantCount={product.groupId ? (variantCounts.get(product.groupId) ?? 1) : 1}
/>
```

And in the list rendering section:
```tsx
<ProductCard key={product.id} product={product} layout="list" />
```
to:
```tsx
<ProductCard
  key={product.id}
  product={product}
  layout="list"
  variantCount={product.groupId ? (variantCounts.get(product.groupId) ?? 1) : 1}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: error about `variantCount` prop not existing on ProductCard — that's expected and will be fixed in Task 8.

- [ ] **Step 5: Commit after Task 8 is done (hold)**

---

## Task 8: Update ProductCard — "N options" pill

**Files:**
- Modify: `components/catalogue/ProductCard.tsx`

- [ ] **Step 1: Add variantCount prop to ProductCardProps**

In `components/catalogue/ProductCard.tsx`, update the `ProductCardProps` interface:

```ts
interface ProductCardProps {
  product: Product;
  layout?: 'grid' | 'list';
  variantCount?: number;
}
```

Update the function signature:
```ts
export default function ProductCard({ product, layout = 'grid', variantCount = 1 }: ProductCardProps) {
```

- [ ] **Step 2: Add "N options" pill in grid layout**

In the grid layout's Info section, after the product name `<h3>`, add:

```tsx
{variantCount > 1 && (
  <p className="text-[9px] text-gold/80 font-medium tracking-wide mt-0.5">
    {variantCount} options available
  </p>
)}
```

So the Info block looks like:
```tsx
{/* Info */}
<div className="p-4">
  <p className="text-xs text-mist mb-1">#{product.id}</p>
  <h3 className="text-xs font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight line-clamp-2 mb-2">
    {product.name}
  </h3>
  {variantCount > 1 && (
    <p className="text-[9px] text-gold/80 font-medium tracking-wide mt-0.5 mb-1">
      {variantCount} options available
    </p>
  )}
  {product.specification && (
    <p className="text-xs text-mist line-clamp-1 mb-3">{product.specification}</p>
  )}
  <div className="flex items-center justify-between">
    <div>
      <span className="font-display text-base font-light text-charcoal">
        {formatPrice(product.price, currency)}
      </span>
      {product.moq > 1 && (
        <span className="text-xs text-mist ml-1.5">MOQ:{product.moq}</span>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 3: Add "N options" pill in list layout**

In the list layout, after the product name `<h3>`, add:

```tsx
{variantCount > 1 && (
  <p className="text-[9px] text-gold/80 font-medium tracking-wide">
    {variantCount} options
  </p>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit Tasks 7 + 8 together**

```bash
git add components/catalogue/CatalogueClient.tsx components/catalogue/ProductCard.tsx
git commit -m "feat: deduplicate grouped products in catalogue, add N options pill to ProductCard"
```

---

## Task 9: Upgrade product detail page — gallery + variant selector

**Files:**
- Modify: `app/[locale]/product/[id]/page.tsx`

- [ ] **Step 1: Import new components and helper**

At the top of `app/[locale]/product/[id]/page.tsx`, update imports:

```ts
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants } from '@/lib/products';
import ProductGallery from '@/components/catalogue/ProductGallery';
import VariantSelector from '@/components/catalogue/VariantSelector';
```

Remove the existing `ProductImage` import (it's now used inside ProductGallery).

- [ ] **Step 2: Compute variants in the page function**

Inside `ProductPage`, after the `related` computation, add:

```ts
const variants = product.groupId ? getProductVariants(product.groupId) : [];
```

- [ ] **Step 3: Replace image block with ProductGallery**

Replace the entire sticky image column (`<div className="lg:sticky lg:top-28">...</div>`) with:

```tsx
<ProductGallery
  mainImage={product.image}
  extraImages={product.images ?? []}
  alt={product.name}
  productId={product.id}
  categoryId={product.categoryId}
  categoryName={category?.name}
  badges={
    <>
      {product.isNew && <span className="badge-new text-xs px-2 py-1">{t('tags.new')}</span>}
      {product.isSale && <span className="badge-sale text-xs px-2 py-1">{t('tags.sale')}</span>}
      {product.isBestSeller && <span className="badge-best text-xs px-2 py-1">{t('tags.bestSeller')}</span>}
    </>
  }
/>
```

- [ ] **Step 4: Add VariantSelector before ProductPrice**

In the Info column, add `<VariantSelector>` right before `<ProductPrice .../>`:

```tsx
<VariantSelector currentProduct={product} variants={variants} />
<ProductPrice price={product.price} moq={product.moq} moqLabel={t('units')} />
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Start dev server and test manually**

```bash
npm run dev
```

Navigate to a product that has variants (check `data/products.json` for any with `groupId` set).
Verify:
- Gallery shows main image + thumbnails below
- Clicking a thumbnail swaps the main image
- "Choose an option" dropdown shows all variant labels + prices
- Selecting a variant navigates to that variant's URL
- Products without variants show no dropdown and no thumbnails

- [ ] **Step 7: Navigate to catalogue and verify deduplication**

Go to `/en/catalogue`. Products that were grouped should now appear as a single card with "N options available" text.

- [ ] **Step 8: Commit**

```bash
git add app/[locale]/product/[id]/page.tsx
git commit -m "feat: integrate ProductGallery and VariantSelector into product detail page"
```

---

## Task 10: Final cleanup + package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify all three new scripts are in package.json**

The scripts section should include:
```json
"group-products": "tsx scripts/group-products.ts",
"scrape-descriptions": "tsx scripts/scrape-descriptions.ts",
"scrape-gallery": "tsx scripts/scrape-gallery-images.ts"
```

These were added in Tasks 2, 3, and 4. Confirm they're all present.

- [ ] **Step 2: Run full build to verify no errors**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Final commit**

```bash
git add package.json
git commit -m "chore: confirm all catalogue upgrade scripts registered in package.json"
```

---

## Running order for data scripts

After all code is deployed, run scripts in this order:

```bash
npm run group-products        # sets groupId + variantLabel
npm run scrape-descriptions   # populates description field
npm run scrape-gallery        # downloads extra images + sets images[]
```

Each script is idempotent — re-running is safe. Use `--force` on `scrape-gallery` to re-download images.
