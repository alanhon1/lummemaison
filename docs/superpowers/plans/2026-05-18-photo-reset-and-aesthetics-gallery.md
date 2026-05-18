# Photo Reset + Aesthetics-Shop-Style Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wipe all product photo data, then upgrade the product detail gallery with crossfade transitions, cross-variant flat-list `<`/`>` navigation, a fullscreen lightbox, and a subtle site-wide edge softening — preparing the codebase for the lummemason rebrand.

**Architecture:** Six tasks across two phases. Phase A (Task 1) is a one-shot data wipe — independent. Phase B (Tasks 2–5) progressively upgrades `ProductGallery.tsx` (crossfade → flat list → cross-variant nav → lightbox) and must land in order because each task builds on the previous data structure. Task 6 (edge softening) is independent but landed last so its visual changes are evaluated against the final gallery.

**Tech Stack:** Next.js 16.2.6 (App Router, async params), React 19 (incl. `createPortal` from `react-dom`), TypeScript 5, Tailwind CSS 4, `lucide-react` (already installed). No test framework — verification = `npx tsc --noEmit`, `npm run lint`, `npm run build`, and manual browser checks on `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-05-18-photo-reset-and-aesthetics-gallery-design.md` (commit `18ccbae`).

---

## File Structure

**Created files:**
- `components/catalogue/ProductLightbox.tsx` — Task 5. Fullscreen modal that reuses `GalleryItem[]` + `activeIdx`. Renders via `createPortal` into `document.body`.

**Modified files:**
- `public/images/products/*.webp` — Task 1. All files deleted.
- `data/products.json` — Task 1. `image`/`groupImage` cleared to `""`, `images` arrays removed.
- `components/catalogue/ProductGallery.tsx` — Tasks 2, 3, 4, 5. Owns crossfade, flat-list state, cross-variant nav, lightbox integration. Exports `GalleryItem` type.
- `app/[locale]/product/[id]/page.tsx` — Task 3. Constructs `galleryItems` + `initialActiveIndex` server-side and passes them to `<ProductGallery />`.
- Several JSX files — Task 6. Add `rounded-sm` to specific high-visibility `border border-bone` panels.

**Untouched (per spec):**
- `lib/products.ts` — Product type stays as-is (`image` / `images?` / `groupImage?` retained).
- `components/catalogue/ProductImage.tsx` — already handles empty `src` correctly (renders gradient placeholder at lines 51–84).
- `components/catalogue/VariantSelector.tsx` — flat-nav reuses existing `/[locale]/product/[id]` routing; no changes needed.
- Existing `.btn-*`, `.badge-*`, `.product-card`, `.skeleton` rules in `app/globals.css` — already rounded 4–8px.

**Spec deviation flagged:** The spec's Unit 6 proposed adding `rounded-sm` to badges and the global `button` reset via `globals.css`. After verification, `.badge-*` are already at 4px (more rounded than 2px) and `.btn-*` at 6px. Reducing them would un-soften the site. Task 6 instead targets the bare `border border-bone` panels in JSX which carry no radius today — these are the visually sharp surfaces the user described.

---

## Task 1: Wipe product photo data

**Files:**
- Delete: every file in `public/images/products/`
- Modify: `data/products.json`

This is a one-shot data operation. A small script is the safest path — it lets us re-run if needed and produces auditable output. We commit the script (in `scripts/`) alongside the data change so the operation is reproducible.

- [ ] **Step 1: Create the wipe script**

Create `scripts/wipe-product-images.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'products');
const JSON_PATH = path.join(ROOT, 'data', 'products.json');

function wipeFiles(): number {
  if (!fs.existsSync(IMG_DIR)) {
    console.log(`(skip) ${IMG_DIR} does not exist`);
    return 0;
  }
  const files = fs.readdirSync(IMG_DIR);
  let n = 0;
  for (const f of files) {
    const p = path.join(IMG_DIR, f);
    const stat = fs.statSync(p);
    if (stat.isFile()) {
      fs.unlinkSync(p);
      n++;
    }
  }
  return n;
}

function wipeJson(): { products: number; cleared: number } {
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);
  let cleared = 0;
  for (const p of data.products) {
    if (p.image && p.image !== '') { p.image = ''; cleared++; }
    if ('images' in p) { delete p.images; cleared++; }
    if ('groupImage' in p && p.groupImage !== '') { p.groupImage = ''; cleared++; }
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return { products: data.products.length, cleared };
}

const filesDeleted = wipeFiles();
const jsonResult = wipeJson();
console.log(`Deleted ${filesDeleted} file(s) from public/images/products/`);
console.log(`Cleared ${jsonResult.cleared} field(s) across ${jsonResult.products} product(s) in data/products.json`);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add inside `"scripts"` (alphabetically slotted; place near other wipe-style scripts if any, or at the bottom):

```json
    "wipe-product-images": "tsx scripts/wipe-product-images.ts",
```

- [ ] **Step 3: Run the script**

Run: `npm run wipe-product-images`

Expected output (numbers will vary slightly):
```
Deleted 458 file(s) from public/images/products/
Cleared 470 field(s) across 438 product(s) in data/products.json
```

- [ ] **Step 4: Verify the wipe**

Run these checks:

```bash
# Directory should be empty (or only contain hidden files)
ls public/images/products/

# Spot-check three products — should show empty image and no images field
node -e "const d=require('./data/products.json'); for(const id of [1,82,200]){const p=d.products.find(x=>x.id===id); console.log(JSON.stringify({id:p.id,name:p.name,image:p.image,images:p.images,groupImage:p.groupImage}))}"
```

Expected: directory listing is empty; the JSON spot-check shows each product with `"image":""`, `"images":undefined`, and `"groupImage":""` (or undefined where it wasn't present).

- [ ] **Step 5: Smoke-test the UI**

Run: `npm run dev`. Open `http://localhost:3000/en/product/1` in a browser.

Expected: page renders without console errors. The image area shows the numbered gradient placeholder (`001` + category name) from `ProductImage.tsx` lines 60–83. No broken `<img>` icons. Catalogue page (`/en/catalogue`) shows the same placeholder uniformly across all cards.

- [ ] **Step 6: Lint and typecheck**

Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run lint`. Expected: exit 0 (or pre-existing warnings only — no new ones).

- [ ] **Step 7: Commit**

```bash
git add scripts/wipe-product-images.ts package.json data/products.json
git rm public/images/products/*.webp
git commit -m "feat(data): wipe all product photo data (files + json refs)"
```

(If `git rm` complains about the `.bak.webp` extension, include it explicitly: `git rm public/images/products/*.webp public/images/products/*.bak.webp`.)

---

## Task 2: Crossfade transitions in ProductGallery

**Files:**
- Modify: `components/catalogue/ProductGallery.tsx`

Replace the single image slot with a two-layer ping-pong crossfade. Each layer is independently controlled; when the active image changes, the off-screen layer loads the new image and the layers swap opacity over 200ms. Both layers stay mounted, eliminating any flash.

- [ ] **Step 1: Add crossfade state and effect**

Open `components/catalogue/ProductGallery.tsx`. Replace the entire file with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Ping-pong crossfade layers.
  // `front` is the visible layer; `back` is preloaded for the next transition.
  const [activeIdx, setActiveIdx] = useState(0);
  const [layers, setLayers] = useState<{ a: number; b: number; front: 'a' | 'b' }>({
    a: 0,
    b: 0,
    front: 'a',
  });

  useEffect(() => {
    setLayers(prev => {
      if (prev[prev.front] === activeIdx) return prev;
      // Load new image into the back layer and swap.
      return prev.front === 'a'
        ? { a: prev.a, b: activeIdx, front: 'b' }
        : { a: activeIdx, b: prev.b, front: 'a' };
    });
  }, [activeIdx]);

  useEffect(() => {
    if (allImages.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIdx(i => (i - 1 + allImages.length) % allImages.length);
      } else if (e.key === 'ArrowRight') {
        setActiveIdx(i => (i + 1) % allImages.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allImages.length]);

  const srcA = allImages[layers.a] ?? mainImage;
  const srcB = allImages[layers.b] ?? mainImage;

  return (
    <div className="lg:sticky lg:top-28">
      <div className="border border-bone aspect-square relative overflow-hidden">
        {/* Layer A */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ opacity: layers.front === 'a' ? 1 : 0 }}
        >
          <ProductImage
            src={srcA}
            alt={alt}
            productId={productId}
            categoryId={categoryId}
            categoryName={categoryName}
            fill={false}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
        {/* Layer B */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ opacity: layers.front === 'b' ? 1 : 0 }}
        >
          <ProductImage
            src={srcB}
            alt={alt}
            productId={productId}
            categoryId={categoryId}
            categoryName={categoryName}
            fill={false}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>

        {badges && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
            {badges}
          </div>
        )}
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx(i => (i - 1 + allImages.length) % allImages.length)}
              className="absolute top-1/2 left-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setActiveIdx(i => (i + 1) % allImages.length)}
              className="absolute top-1/2 right-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {allImages.length > 1 && (
        <div className="flex gap-2 mt-3">
          {allImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`w-16 h-16 border relative overflow-hidden flex-shrink-0 transition-all duration-200 ${
                activeIdx === i ? 'border-gold' : 'border-bone hover:border-gold/50'
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

This preserves the existing prop signature (`mainImage` + `extraImages`) — Task 3 will replace it with the new flat-list signature. Doing it in two steps keeps each diff small and reviewable.

- [ ] **Step 2: Verify crossfade in browser**

Run: `npm run dev`. Open a product detail URL — even with empty images (post-Task-1 state), the page still renders. To exercise crossfade, temporarily restore one product's `image` field in `data/products.json` to a test path (or skip ahead and verify after Task 3 once you have real cycling data). For now:

- Open `http://localhost:3000/en/product/1`.
- Click the `>` arrow button. The image area should fade rather than hard-cut. With placeholder gradients, you'll see one tint blend into another over ~200ms.
- Press `→` (right arrow) and `←` (left arrow) on the keyboard. Same fade.
- DevTools → Performance: no layout thrashing during the transition.

- [ ] **Step 3: Lint, typecheck, build**

Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run lint`. Expected: exit 0 (no new warnings).
Run: `npm run build`. Expected: exits 0, no compile errors in `ProductGallery.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/catalogue/ProductGallery.tsx
git commit -m "feat(gallery): crossfade transition on image change (ping-pong layers)"
```

---

## Task 3: Server-built flat list (page + gallery prop refactor)

**Files:**
- Modify: `components/catalogue/ProductGallery.tsx` (prop signature + export type)
- Modify: `app/[locale]/product/[id]/page.tsx` (build `galleryItems` + `initialActiveIndex`)

Replace the gallery's `mainImage` / `extraImages` props with a single flat list of `GalleryItem` plus an `initialActiveIndex`. For grouped products, this list spans all variants in `getProductVariants` order. The gallery's nav behavior stays per-product in this task — Task 4 adds the cross-variant navigation.

- [ ] **Step 1: Export the `GalleryItem` type and update props**

In `components/catalogue/ProductGallery.tsx`, replace the top of the file (imports + type + props) with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductImage from './ProductImage';

export type GalleryItem = {
  productId: number;
  href: string;
  src: string;
  alt: string;
  variantLabel?: string;
};

interface ProductGalleryProps {
  items: GalleryItem[];
  initialActiveIndex: number;
  alt: string;
  productId: number;
  categoryId: string;
  categoryName?: string;
  badges?: React.ReactNode;
}
```

Then update the component body. Replace:

```tsx
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
```

with:

```tsx
export default function ProductGallery({
  items,
  initialActiveIndex,
  alt,
  productId,
  categoryId,
  categoryName,
  badges,
}: ProductGalleryProps) {
  const safeInitial = Math.max(0, Math.min(initialActiveIndex, items.length - 1));
```

Then replace every reference to `allImages` with `items` and every reference to an image string (e.g. `allImages[activeIdx]`) with `items[activeIdx].src`. Specifically:

- `const [activeIdx, setActiveIdx] = useState(0);` → `const [activeIdx, setActiveIdx] = useState(safeInitial);`
- Initial `layers` state: `{ a: 0, b: 0, front: 'a' }` → `{ a: safeInitial, b: safeInitial, front: 'a' }`
- `allImages.length` (multiple places) → `items.length`
- `allImages[layers.a] ?? mainImage` → `items[layers.a]?.src ?? ''`
- `allImages[layers.b] ?? mainImage` → `items[layers.b]?.src ?? ''`
- The thumbnail map: `allImages.map((img, i) => (...))` → `items.map((it, i) => (...))` with `img` references inside swapped to `it.src` and the alt prop pulled from `it.alt` (or kept as the outer `alt` prop)

The full revised body inside the layers `<div>`:

```tsx
<div
  className="absolute inset-0 transition-opacity duration-200"
  style={{ opacity: layers.front === 'a' ? 1 : 0 }}
>
  <ProductImage
    src={items[layers.a]?.src ?? ''}
    alt={alt}
    productId={productId}
    categoryId={categoryId}
    categoryName={categoryName}
    fill={false}
    sizes="(max-width: 1024px) 100vw, 50vw"
  />
</div>
```

And the thumbnail strip:

```tsx
{items.length > 1 && (
  <div className="flex gap-2 mt-3">
    {items.map((it, i) => (
      <button
        key={i}
        onClick={() => setActiveIdx(i)}
        className={`w-16 h-16 border relative overflow-hidden flex-shrink-0 transition-all duration-200 ${
          activeIdx === i ? 'border-gold' : 'border-bone hover:border-gold/50'
        }`}
        aria-label={it.variantLabel ? `${it.alt} (${it.variantLabel}) view ${i + 1}` : `${alt} view ${i + 1}`}
      >
        <ProductImage
          src={it.src}
          alt={`${alt} view ${i + 1}`}
          productId={it.productId}
          categoryId={categoryId}
          fill={false}
          sizes="64px"
        />
      </button>
    ))}
  </div>
)}
```

Also add a sync effect right after the existing `useState` declarations so the gallery resets if the page navigates to a sibling variant (preparing for Task 4):

```tsx
useEffect(() => {
  setActiveIdx(safeInitial);
}, [safeInitial]);
```

- [ ] **Step 2: Update the product detail page to build the flat list**

Open `app/[locale]/product/[id]/page.tsx`. Add an import for `GalleryItem`:

```tsx
import ProductGallery, { type GalleryItem } from '@/components/catalogue/ProductGallery';
```

Remove the old default import line if it still exists. Then, inside `ProductPage`, after the existing `const variants = ...` line (line 36), insert:

```tsx
const galleryItems: GalleryItem[] = product.groupId
  ? variants.flatMap(v => {
      const main: GalleryItem = {
        productId: v.id,
        href: `/${locale}/product/${v.id}`,
        src: v.image,
        alt: v.name,
        variantLabel: v.variantLabel,
      };
      const extras: GalleryItem[] = (v.images ?? []).map(img => ({
        productId: v.id,
        href: `/${locale}/product/${v.id}`,
        src: img,
        alt: v.name,
        variantLabel: v.variantLabel,
      }));
      return [main, ...extras];
    }).filter(it => it.src)
  : [
      {
        productId: product.id,
        href: `/${locale}/product/${product.id}`,
        src: product.image,
        alt: product.name,
      },
      ...(product.images ?? []).map(img => ({
        productId: product.id,
        href: `/${locale}/product/${product.id}`,
        src: img,
        alt: product.name,
      } as GalleryItem)),
    ].filter(it => it.src);

const initialActiveIndex = Math.max(
  0,
  galleryItems.findIndex(it => it.productId === product.id && it.src === product.image)
);
```

Note: `variants` is `[]` when there is no `groupId`, but the conditional uses `product.groupId` directly so we never call `flatMap` on an empty group.

Then update the `<ProductGallery />` JSX call (currently at lines 72–86) — replace `mainImage={...}` and `extraImages={...}` with the new props:

```tsx
<ProductGallery
  items={galleryItems}
  initialActiveIndex={initialActiveIndex}
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

- [ ] **Step 3: Handle empty `items` gracefully in the gallery**

Inside `ProductGallery.tsx`, near the top of the return statement (before the main container), add a fallback so an empty flat list still renders something:

```tsx
if (items.length === 0) {
  return (
    <div className="lg:sticky lg:top-28">
      <div className="border border-bone aspect-square relative overflow-hidden">
        <ProductImage
          src=""
          alt={alt}
          productId={productId}
          categoryId={categoryId}
          categoryName={categoryName}
          fill={false}
        />
        {badges && (
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
            {badges}
          </div>
        )}
      </div>
    </div>
  );
}
```

After Task 1, every product has `image: ""`, so this branch is the rendering path until images are restored. It must work cleanly.

- [ ] **Step 4: Verify in browser**

Run: `npm run dev`. Hit:

- `http://localhost:3000/en/product/1` — non-grouped product. Gallery shows the empty-items fallback (placeholder + badges, no arrows, no thumbnails). No errors in console.
- `http://localhost:3000/en/product/82` — pick any grouped product (find one by running `node -e "const d=require('./data/products.json'); console.log(d.products.filter(p=>p.groupId).slice(0,3).map(p=>({id:p.id,name:p.name,groupId:p.groupId})))"`). Same fallback applies because all images are empty.

To exercise the new flat list with real data, temporarily restore one product's `image` field in `data/products.json` (e.g. to `/images/products/product-1.webp` — file won't exist but the component will pass `src` through) and reload. The gallery should show a single-item flat list with no arrows (length 1).

For a grouped scenario, set `image` on two or three variants of a same `groupId` in the JSON, reload — the flat list should now have multiple items, arrows appear, and clicking through cycles them. The URL does NOT change yet (Task 4).

Revert any temporary JSON edits before committing.

- [ ] **Step 5: Lint, typecheck, build**

Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run lint`. Expected: exit 0.
Run: `npm run build`. Expected: clean compile.

- [ ] **Step 6: Commit**

```bash
git add components/catalogue/ProductGallery.tsx app/\[locale\]/product/\[id\]/page.tsx
git commit -m "feat(gallery): server-built flat list of gallery items per group"
```

---

## Task 4: Cross-variant `<`/`>` navigation + prefetch

**Files:**
- Modify: `components/catalogue/ProductGallery.tsx`

Make `<`/`>` and keyboard arrows aware of variant boundaries: when the next index points to a different `productId`, push the new route via `next/navigation`'s router while still updating local state immediately (so the crossfade kicks off without waiting for the navigation). Prefetch every unique variant URL on mount so cross-boundary transitions are instant.

- [ ] **Step 1: Add the router and the `goTo` handler**

In `components/catalogue/ProductGallery.tsx`, add to the imports:

```tsx
import { useRouter } from 'next/navigation';
```

Inside the component body, after the existing state declarations and before the keyboard `useEffect`, add:

```tsx
const router = useRouter();

const goTo = (rawIdx: number) => {
  if (items.length === 0) return;
  const nextIdx = ((rawIdx % items.length) + items.length) % items.length;
  if (nextIdx === activeIdx) return;
  const crossingBoundary = items[nextIdx].productId !== items[activeIdx].productId;
  setActiveIdx(nextIdx);
  if (crossingBoundary) {
    router.push(items[nextIdx].href, { scroll: false });
  }
};

useEffect(() => {
  const uniqueHrefs = new Set(items.map(it => it.href));
  uniqueHrefs.forEach(href => router.prefetch(href));
}, [items, router]);
```

- [ ] **Step 2: Route all navigation through `goTo`**

Replace the three nav callsites:

Replace the entire existing keyboard `useEffect` block:

```tsx
useEffect(() => {
  if (items.length <= 1) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goTo(activeIdx - 1);
    } else if (e.key === 'ArrowRight') {
      goTo(activeIdx + 1);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [activeIdx, items.length]);
```

Re-binding the event handler on every `activeIdx` change is mildly wasteful but correct. If lint warns about `goTo` not being in deps, accept the warning — `goTo` reads `activeIdx` and `items` from closure and is correct as-is. (Task 5 will add one more guard to this block to defer to the lightbox.)

Arrow buttons:

```tsx
<button
  onClick={() => goTo(activeIdx - 1)}
  className="absolute top-1/2 left-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
  aria-label="Previous image"
>
  <ChevronLeft size={18} />
</button>
<button
  onClick={() => goTo(activeIdx + 1)}
  className="absolute top-1/2 right-3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-opacity"
  aria-label="Next image"
>
  <ChevronRight size={18} />
</button>
```

Thumbnail `onClick`:

```tsx
onClick={() => goTo(i)}
```

- [ ] **Step 3: Verify cross-variant navigation manually**

Run: `npm run dev`. To exercise this you need at least one product group with multiple non-empty images across variants. Restore a few image references in `data/products.json` for testing:

```bash
# Find a grouped product set in JSON (read-only)
node -e "const d=require('./data/products.json'); const grouped=d.products.filter(p=>p.groupId); const groups=[...new Set(grouped.map(p=>p.groupId))]; console.log(groups.slice(0,3).map(g=>({groupId:g, members: grouped.filter(p=>p.groupId===g).map(p=>p.id)})))"
```

Pick a group with 2+ members. In the JSON, set each member's `image` to a distinct placeholder URL (e.g. `https://placehold.co/600x600/png?text=Variant-A`, `...Variant-B`, `...Variant-C` — these don't require local files). Reload the first variant's product page.

Verify in the browser:
- The gallery now shows arrows because the flat list has 2+ items.
- Clicking `>` from the first variant's image: the URL in the address bar updates to the second variant's `/product/[id]` (e.g. `/en/product/83`), and the price panel + variant selector reflect the new variant. The image area crossfades to the new placeholder. No visible page reload (the change should feel like a state update).
- Holding `→`: cycles through every variant's images and wraps back to the first. URL updates each time a boundary is crossed.
- Clicking a thumbnail several variants away: jumps directly, with URL update if crossing a boundary.
- Network tab: variant pages should load instantly because of the prefetch (look for prefetched RSC chunks under document/script).

Once verified, revert your JSON edits.

- [ ] **Step 4: Lint, typecheck, build**

Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run lint`. Expected: exit 0.
Run: `npm run build`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/catalogue/ProductGallery.tsx
git commit -m "feat(gallery): cross-variant </> nav with prefetched neighbors"
```

---

## Task 5: Fullscreen lightbox

**Files:**
- Create: `components/catalogue/ProductLightbox.tsx`
- Modify: `components/catalogue/ProductGallery.tsx`

Add a lightbox component that mounts via `createPortal` into `document.body`. The gallery owns one piece of new state (`lightboxOpen: boolean`) and passes its `items` + `activeIdx` + `goTo` to the lightbox so they share a single source of truth. Closing the lightbox leaves the inline gallery on whatever image the user last viewed.

- [ ] **Step 1: Create the lightbox component**

Create `components/catalogue/ProductLightbox.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import ProductImage from './ProductImage';
import type { GalleryItem } from './ProductGallery';

interface ProductLightboxProps {
  open: boolean;
  onClose: () => void;
  items: GalleryItem[];
  activeIdx: number;
  onPrev: () => void;
  onNext: () => void;
  categoryId: string;
}

export default function ProductLightbox({
  open,
  onClose,
  items,
  activeIdx,
  onPrev,
  onNext,
  categoryId,
}: ProductLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previouslyFocused.current = document.activeElement;
    // Focus the close button on open.
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = original;
      // Restore focus on close.
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open]);

  // Keyboard handling: Esc closes, arrows navigate.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      } else if (e.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!open) return null;
  if (typeof document === 'undefined') return null; // SSR safety
  if (items.length === 0) return null;

  const current = items[activeIdx];

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Close button */}
      <button
        ref={closeButtonRef}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      {/* Image */}
      <div
        className="relative"
        style={{ maxWidth: '90vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          key={`lightbox-${activeIdx}`}
          className="w-[90vw] h-[85vh] flex items-center justify-center"
        >
          <div className="relative w-full h-full">
            <ProductImage
              src={current.src}
              alt={current.alt}
              productId={current.productId}
              categoryId={categoryId}
              fill={false}
            />
          </div>
        </div>
      </div>

      {/* Arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute top-1/2 left-6 -translate-y-1/2 w-12 h-12 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute top-1/2 right-6 -translate-y-1/2 w-12 h-12 rounded-full bg-charcoal/70 hover:bg-charcoal text-cream flex items-center justify-center transition-colors"
            aria-label="Next image"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Counter */}
      {items.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-cream text-sm tracking-wider">
          {activeIdx + 1} / {items.length}
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}
```

- [ ] **Step 2: Wire the gallery to open the lightbox**

In `components/catalogue/ProductGallery.tsx`, add to imports:

```tsx
import ProductLightbox from './ProductLightbox';
```

Add state inside the component (near the other `useState` calls):

```tsx
const [lightboxOpen, setLightboxOpen] = useState(false);
```

Then update the keyboard `useEffect` from Task 4 to defer to the lightbox when it's open (otherwise both handlers fire per keypress and navigation jumps by two):

```tsx
useEffect(() => {
  if (items.length <= 1) return;
  if (lightboxOpen) return; // Lightbox owns keyboard nav while open
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      goTo(activeIdx - 1);
    } else if (e.key === 'ArrowRight') {
      goTo(activeIdx + 1);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [activeIdx, items.length, lightboxOpen]);
```

Make the main image area clickable. Find the outer `<div className="border border-bone aspect-square relative overflow-hidden">` and add `onClick` + cursor style:

```tsx
<div
  className="border border-bone aspect-square relative overflow-hidden cursor-zoom-in"
  onClick={() => items.length > 0 && setLightboxOpen(true)}
>
```

Ensure the arrow buttons and badges don't bubble their clicks up to the parent — wrap their `onClick` handlers with `stopPropagation`:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); goTo(activeIdx - 1); }}
  ...
>
<button
  onClick={(e) => { e.stopPropagation(); goTo(activeIdx + 1); }}
  ...
>
```

For the badges container, add `pointer-events-none` (which Task 2 already adds — verify it's still there).

At the bottom of the return (just before the closing `</div>` of the outermost `lg:sticky` wrapper), render the lightbox:

```tsx
<ProductLightbox
  open={lightboxOpen}
  onClose={() => setLightboxOpen(false)}
  items={items}
  activeIdx={activeIdx}
  onPrev={() => goTo(activeIdx - 1)}
  onNext={() => goTo(activeIdx + 1)}
  categoryId={categoryId}
/>
```

- [ ] **Step 3: Verify the lightbox manually**

Run: `npm run dev`. Use the same temporary JSON test data approach as Task 4 (set distinct `image` URLs on a grouped product's variants). Then:

- Open the first variant's page. Click the main image area (not an arrow). The lightbox should open with a fade-and-slight-scale animation, showing the image at near-fullscreen with a `<` `>` arrow set, an `X` in the top-right, and a counter at the bottom.
- Click `>` inside the lightbox. The image changes, the counter increments, and (if you cross a variant boundary) the URL in the address bar updates while the lightbox stays open.
- Press `←` / `→` on the keyboard — same nav. Verify the underlying inline gallery does NOT also advance (without the lightbox-open guard added in Step 2, both would fire and jump by two — if you see this, Step 2's guard didn't take effect).
- Press `Esc` — lightbox closes; focus should return to roughly the main image area (or its container).
- Click the dark backdrop outside the image — lightbox closes.
- Click the `X` — lightbox closes.
- While the lightbox is open, the page underneath should not scroll (try scrolling with the mouse wheel — nothing happens).
- **Cross-variant survival check.** Open the lightbox, press `>` enough times to cross at least one variant boundary, confirm the lightbox stays open the whole time. In Next.js App Router, sibling-route navigation under the same layout normally preserves `ProductGallery`'s mounted state — so `lightboxOpen` survives. If the lightbox blinks shut mid-cycle, that means React is remounting the gallery, and `lightboxOpen` should be lifted out (e.g. into a Zustand store) — flag and revisit.

Revert temporary JSON edits.

- [ ] **Step 4: Lint, typecheck, build**

Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run lint`. Expected: exit 0.
Run: `npm run build`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/catalogue/ProductLightbox.tsx components/catalogue/ProductGallery.tsx
git commit -m "feat(gallery): fullscreen lightbox sharing flat-list state"
```

---

## Task 6: Subtle site-wide edge softening

**Files:**
- Modify: `components/catalogue/ProductCard.tsx`
- Modify: `app/[locale]/product/[id]/page.tsx`
- Modify: `components/catalogue/CatalogueClient.tsx`
- Modify: `components/checkout/CartPageClient.tsx`
- Modify: `components/checkout/CheckoutClient.tsx`
- Modify: `components/checkout/PaymentClient.tsx`
- Modify: `components/layout/CartPanel.tsx`

Add `rounded-sm` (Tailwind v4 = 2px) to the most visible customer-facing `border border-bone` containers. Image frames stay sharp. Admin panels (`components/admin/*`) are out of scope. The already-rounded `.btn-*`, `.badge-*`, `.product-card`, and inputs (via existing rule in `globals.css` lines 260–266) are untouched.

- [ ] **Step 1: ProductCard outer wrapper**

In `components/catalogue/ProductCard.tsx:45`, change:

```tsx
className="flex gap-4 p-4 bg-white border border-bone hover:border-gold transition-all duration-300 group"
```

to:

```tsx
className="flex gap-4 p-4 bg-white border border-bone rounded-sm hover:border-gold transition-all duration-300 group"
```

Also at line 89, the icon button:

```tsx
className="self-center flex-shrink-0 w-9 h-9 border border-bone flex items-center justify-center hover:border-gold hover:text-gold text-charcoal transition-colors"
```

→ add `rounded-sm`:

```tsx
className="self-center flex-shrink-0 w-9 h-9 border border-bone rounded-sm flex items-center justify-center hover:border-gold hover:text-gold text-charcoal transition-colors"
```

- [ ] **Step 2: Product detail page specification panel**

In `app/[locale]/product/[id]/page.tsx:111`, change:

```tsx
<div className="mb-6 p-4 bg-white border border-bone">
```

to:

```tsx
<div className="mb-6 p-4 bg-white border border-bone rounded-sm">
```

- [ ] **Step 3: Catalogue search/filter chrome**

In `components/catalogue/CatalogueClient.tsx`, three locations:

Line 282:
```tsx
className="lg:hidden flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase border border-bone px-3 py-2 hover:border-gold hover:text-gold transition-colors"
```
→ add `rounded-sm`.

Line 289:
```tsx
<div className="flex-1 min-w-48 max-w-sm flex items-center gap-2 border border-bone px-3 py-2 focus-within:border-gold transition-colors">
```
→ add `rounded-sm`.

Line 310:
```tsx
className="text-xs border border-bone px-3 py-2 pr-7 bg-white text-charcoal outline-none hover:border-gold transition-colors appearance-none cursor-pointer"
```
→ add `rounded-sm`.

- [ ] **Step 4: Cart and checkout panels**

In `components/checkout/CartPageClient.tsx`:
- Line 33: `className="flex gap-4 p-4 bg-white border border-bone"` → add `rounded-sm`.
- Line 95: `className="bg-white border border-bone p-6 h-fit"` → add `rounded-sm`.
- Lines 50, 57: the small 7×7 quantity buttons (`className="w-7 h-7 border border-bone ..."`) → add `rounded-sm`.

In `components/checkout/CheckoutClient.tsx`:
- Lines 100, 153, 185: each `<div className="bg-white border border-bone p-6 ...">` → add `rounded-sm`.

In `components/checkout/PaymentClient.tsx`:
- Lines 40, 58, 84, 131: the `bg-white border border-bone p-…` outer panels → add `rounded-sm`.
- Lines 44, 62, 88: the `bg-cream border border-bone …` info panels → add `rounded-sm`.

In `components/layout/CartPanel.tsx`:
- Lines 95, 102: the small 6×6 quantity buttons (`className="w-6 h-6 border border-bone ..."`) → add `rounded-sm`.

- [ ] **Step 5: Verify visual change in browser**

Run: `npm run dev`. Walk these pages and compare against memory of the pre-change look:

- `http://localhost:3000/en` — home. Headers, sections.
- `http://localhost:3000/en/catalogue` — catalogue cards, search bar, filter chips.
- `http://localhost:3000/en/product/1` — detail page specification panel.
- Add an item to the cart and open the cart panel — item rows, quantity buttons.
- `http://localhost:3000/en/cart` — cart page.
- `http://localhost:3000/en/checkout` — checkout panels.

Expected: a barely-perceptible softening on the panels and chrome listed above. The image frame on the product detail page stays sharp (intentional). The catalogue product cards now have a tiny radius. CTAs / badges look unchanged because they were already rounded.

If the change is "too subtle to notice anywhere," bump `rounded-sm` to `rounded` (4px) in the same spots — but the spec asks for subtle, so 2px is the right starting point.

- [ ] **Step 6: Lint, typecheck, build**

Run: `npx tsc --noEmit`. Expected: exit 0.
Run: `npm run lint`. Expected: exit 0.
Run: `npm run build`. Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/catalogue/ProductCard.tsx app/\[locale\]/product/\[id\]/page.tsx components/catalogue/CatalogueClient.tsx components/checkout/CartPageClient.tsx components/checkout/CheckoutClient.tsx components/checkout/PaymentClient.tsx components/layout/CartPanel.tsx
git commit -m "feat(ui): soften high-visibility border-bone panels with rounded-sm"
```

---

## Final verification

After all six tasks have landed:

- [ ] **Run the full check suite once more**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three should exit 0 with no new warnings vs. main.

- [ ] **Smoke test the full flow**

`npm run dev`, then:

1. Home renders without errors.
2. Catalogue renders the placeholder gradient on every product card.
3. Click into any product detail page — gallery shows the empty-items fallback with placeholder + badges, no arrows.
4. Manually restore a couple of images on a grouped product in `data/products.json` for one final cross-variant smoke (then revert): arrows work, crossfade is smooth, URL updates on boundary, lightbox opens on click, Esc/backdrop closes it.
5. Walk through the catalogue → cart → checkout flow. Confirm the edge softening is present but not bubbly on cards, search bar, cart rows, and checkout panels.

- [ ] **Confirm the working tree is clean**

```bash
git status
```

Expected: clean (or only `.claude/settings.local.json` if it was already modified — unrelated).
