# Spec: Photo Data Reset + Aesthetics-Shop-Style Gallery

**Date**: 2026-05-18
**Status**: Approved (awaiting plan)
**Scope batch**: Pre-rebrand setup (lummemason). Two quick tasks before main work begins.

## Background

The site is being rebranded from "Lumière" to "lummemason" and product photos will be re-shot / re-sourced. Before that, the existing product imagery must be wiped clean and the product detail gallery must be upgraded to match the navigation feel of [aesthetics-shop.com](https://aesthetics-shop.com/) — smooth photo swiping, a fullscreen inspect view, and (for grouped products) photos that cycle across variants automatically.

The existing `ProductGallery` (added in commit `152e34d`) already has `<`/`>` arrows, keyboard nav, and a thumbnail strip. This spec extends that foundation; it does not replace it.

## Goals

1. **Wipe product photo data.** Delete every file in `public/images/products/` and clear `image` / `images` / `groupImage` fields in every product entry of `data/products.json`. Leave the schema, types, and component code intact so new images can be added later.
2. **Crossfade transitions.** Replace the hard image swap on `<`/`>` / keyboard / thumbnail clicks with a ~200ms opacity crossfade.
3. **Flat-list variant nav.** For a product in a group (e.g. Sosum S / M / L), the `<` and `>` arrows on the gallery cycle through a single flat sequence of all variants' images. Crossing a variant boundary updates the URL, price panel, and `VariantSelector` automatically.
4. **Fullscreen lightbox.** Clicking the main image opens a fullscreen modal showing the photo at full size, with its own `<`/`>` arrows reusing the same flat-list (variant boundaries included), Esc/backdrop-click to close.
5. **Site-wide edge softening.** Apply a subtle `rounded-sm` (2px) to buttons, badges, and inputs. Keep image-container borders and card outlines sharp.

## Non-goals (YAGNI)

- Rebranding from "Lumière" to "lummemason" in code/copy. That's a separate task; this spec only wipes photos and ships gallery improvements.
- Pinch-zoom, drag-to-pan, or in-place magnifier lens inside the lightbox. Lightbox shows the image at fit-to-viewport; users navigate via arrows.
- Mobile swipe gestures on the gallery or lightbox. Buttons + keyboard cover the use case.
- Touch-zoom on the main image (hover magnifier). User explicitly chose lightbox-only.
- A new global image-upload flow. The admin upload endpoint (`app/api/admin/upload-image/route.ts`) already exists and is untouched.
- Changes to category pages, catalogue grid, home page sections, or any other carousel-shaped surface. Out of scope.
- Animation libraries (Framer Motion, react-spring). Pure CSS opacity transitions are sufficient.

## Current state (verified 2026-05-18)

- `public/images/products/` contains 458 `.webp` files, including `-2`, `-3`, `-4` extra-view variants and one `.bak.webp` backup.
- `data/products.json` has `categories[]` and `products[]`. Every product carries an `image` (non-empty string). Some carry `images: string[]` (extra views). Grouped products carry `groupName` and `groupImage`.
- `lib/products.ts` defines `Product` with `image: string`, `images?: string[]`, `groupImage?: string`, `groupId?: string`, `variantLabel?: string`. `getProductVariants(groupId)` returns variants sorted by id.
- `components/catalogue/ProductGallery.tsx` (`'use client'`) renders the main image + thumbnail strip + `<`/`>` arrows + keyboard arrow nav. Wraps around within a single product's images. Imports `ProductImage`.
- `components/catalogue/ProductImage.tsx` is the placeholder-aware image renderer (verify it handles `src === ''` cleanly during implementation; if not, add that branch).
- `components/catalogue/VariantSelector.tsx` renders the variant chips for grouped products. Each chip is a `<Link>` to `/[locale]/product/[variantId]`.
- `app/[locale]/product/[id]/page.tsx` is a server component. It reads the product, computes `category`, `related`, `variants`, and passes `mainImage={product.image}` + `extraImages={product.images ?? []}` to `<ProductGallery />`.
- Tailwind defaults: `rounded-sm = 2px`, `rounded = 4px`, `rounded-md = 6px`, `rounded-lg = 8px`. No global border-radius is currently set on `body`, buttons, or `app/globals.css` resets. Badges `.badge-new`, `.badge-sale`, `.badge-best` live in `app/globals.css`.

## Design

Six units. Units 1 (photo wipe), 2 (crossfade), and 6 (edge softening) are independent and can ship in any order. Units 3 (server flat list), 4 (client nav), and 5 (lightbox) share the same flat-list state and must land in that order — each depends on the previous.

### Unit 1 — Photo data deletion

**Files:**
- `public/images/products/*` (filesystem delete)
- `data/products.json`

**Filesystem.** Delete every file inside `public/images/products/`. Keep the directory itself. Do not touch `public/APR2026-CATALOGUE.pdf`, the `*.svg` icons, `robots.txt`, `missing-images.txt`, or `missingproducts.txt`. Do not touch `data/backups/products-*.json`.

**JSON edits to `data/products.json#products[]`.** For each product entry:
- Set `image` to `""`.
- Delete the `images` field if present.
- Set `groupImage` to `""` if present (only present on grouped products).

Leave `categories[]` and all non-image fields untouched.

**Code untouched.** `Product` type retains `image`, `images?`, `groupImage?`. Verify `ProductImage` handles empty `src` without runtime error — if it doesn't, add an early return that renders the existing placeholder branch. No type changes, no schema changes.

### Unit 2 — Crossfade transition in `ProductGallery`

**Files:** `components/catalogue/ProductGallery.tsx`

The main image area becomes two stacked layers:

```tsx
<div className="border border-bone aspect-square relative overflow-hidden">
  {/* Previous layer (fading out) */}
  <div className="absolute inset-0 transition-opacity duration-200" style={{ opacity: previousIdx === activeIdx ? 0 : 1 }}>
    <ProductImage src={items[previousIdx]?.src ?? ''} ... />
  </div>
  {/* Current layer (fading in) */}
  <div className="absolute inset-0 transition-opacity duration-200" style={{ opacity: 1 }}>
    <ProductImage src={items[activeIdx]?.src ?? ''} ... />
  </div>
  {/* Badges + arrows on top */}
</div>
```

`previousIdx` is held in state; updated to the *old* `activeIdx` whenever `activeIdx` changes. Both layers stay mounted during the 200ms fade. Arrow buttons remain responsive — rapid clicks short-circuit the previous fade by overwriting `previousIdx`.

No external animation library. CSS transition only.

### Unit 3 — Flat-list gallery items (server-side construction)

**Files:** `app/[locale]/product/[id]/page.tsx`, `components/catalogue/ProductGallery.tsx` (prop signature)

**Type (exported from `ProductGallery.tsx`):**

```ts
export type GalleryItem = {
  productId: number;
  href: string;
  src: string;
  alt: string;
  variantLabel?: string;
};
```

**Server-side construction in the product page:**

```ts
const galleryItems: GalleryItem[] = product.groupId
  ? getProductVariants(product.groupId).flatMap(v => [
      {
        productId: v.id,
        href: `/${locale}/product/${v.id}`,
        src: v.image,
        alt: v.name,
        variantLabel: v.variantLabel,
      },
      ...(v.images ?? []).map(img => ({
        productId: v.id,
        href: `/${locale}/product/${v.id}`,
        src: img,
        alt: v.name,
        variantLabel: v.variantLabel,
      })),
    ]).filter(it => it.src)
  : [
      { productId: product.id, href: `/${locale}/product/${product.id}`, src: product.image, alt: product.name },
      ...(product.images ?? []).map(img => ({
        productId: product.id,
        href: `/${locale}/product/${product.id}`,
        src: img,
        alt: product.name,
      })),
    ].filter(it => it.src);

const initialActiveIndex = Math.max(
  0,
  galleryItems.findIndex(it => it.productId === product.id && it.src === product.image)
);
```

**Prop signature change to `<ProductGallery />`:** replace `mainImage` + `extraImages` with `items: GalleryItem[]` + `initialActiveIndex: number`. Keep `alt`, `productId`, `categoryId`, `categoryName`, `badges`.

### Unit 4 — Cross-variant `<`/`>` navigation in `ProductGallery`

**Files:** `components/catalogue/ProductGallery.tsx`

`activeIdx` is local state, initialized from `initialActiveIndex`. A `useEffect` resyncs `activeIdx` whenever `initialActiveIndex` changes (this fires after a `router.push` to a sibling variant page re-renders the page with a new initial index).

**Navigation handler:**

```ts
const router = useRouter();

const goTo = (rawIdx: number) => {
  if (items.length === 0) return;
  const nextIdx = ((rawIdx % items.length) + items.length) % items.length;
  const crossingBoundary = items[nextIdx].productId !== items[activeIdx].productId;
  setActiveIdx(nextIdx);
  if (crossingBoundary) {
    router.push(items[nextIdx].href, { scroll: false });
  }
};
```

Arrow buttons, keyboard handler, and thumbnail clicks all call `goTo(...)`. Wrap-around covers the entire flat list (last → first).

**Prefetch on mount:**

```ts
useEffect(() => {
  const uniqueHrefs = new Set(items.map(it => it.href));
  uniqueHrefs.forEach(href => router.prefetch(href));
}, [items, router]);
```

This warms the Next.js router cache so boundary-crossing navigation is near-instant. Max ~20 unique URLs per group — cheap.

**Why no flicker across boundaries.** Sibling variant pages compute the *same* `galleryItems` array (same group, same sort order). After `router.push`, the new page renders with `initialActiveIndex` equal to the position of its own main image in the flat list — which is the index the user just crossfaded to. The `useEffect` resync is a no-op in steady state; on re-mount, both layers render the same image and no visible change occurs.

### Unit 5 — Fullscreen lightbox

**Files:** `components/catalogue/ProductLightbox.tsx` (new), `components/catalogue/ProductGallery.tsx` (lift trigger + lightbox state).

**Trigger.** The main image area in `ProductGallery` becomes clickable (cursor `cursor-zoom-in`). Click → set `lightboxOpen = true`. Arrow buttons stop propagation so clicking them doesn't open the lightbox. Badges container also gets `pointer-events-none`.

**Component contract:**

```ts
interface ProductLightboxProps {
  open: boolean;
  onClose: () => void;
  items: GalleryItem[];
  activeIdx: number;
  onChange: (idx: number) => void;  // delegates to the parent's goTo so URL also updates
}
```

State is lifted: `ProductGallery` owns `activeIdx` and passes it + `goTo` to the lightbox. The two components share one source of truth — closing the lightbox keeps the inline gallery on whatever image the user last viewed.

**Layout (Tailwind):**
- Outer: `fixed inset-0 z-50 flex items-center justify-center bg-charcoal/90 backdrop-blur-sm`.
- Mount via `createPortal(..., document.body)` so it escapes any `overflow: hidden` ancestor.
- Entrance animation: `opacity-0 scale-95` → `opacity-100 scale-100`, 150ms transition.
- Image: `max-w-[90vw] max-h-[85vh] object-contain` inside its own crossfade pair of layers (same two-layer pattern as Unit 2).
- Close button: top-right, `top-6 right-6`, `w-10 h-10 rounded-full bg-charcoal/70`.
- Arrow buttons: `left-6` / `right-6`, larger than inline gallery (`w-12 h-12`).
- Index counter: `bottom-8 left-1/2 -translate-x-1/2 text-cream text-sm` showing `${activeIdx + 1} / ${items.length}`.

**Keyboard / focus.**
- Esc closes.
- `<` / `>` arrows trigger nav (same handler as inline arrows).
- Focus trap: focus the close button on open; on close, return focus to the main image trigger.
- Body scroll lock: set `document.body.style.overflow = 'hidden'` on open, clear on close.

**Backdrop click closes.** Image and chrome elements stop propagation; clicks on the outer backdrop call `onClose`.

### Unit 6 — Site-wide edge softening

**Files:** `app/globals.css`, plus targeted Tailwind class additions in component files where buttons/inputs are class-styled (not theme-driven).

**Approach.** Add `rounded-sm` (2px) to:
- `.badge-new`, `.badge-sale`, `.badge-best` in `app/globals.css`.
- All `<button>` elements that don't already specify a radius. Two ways:
  - **Preferred:** add `button { @apply rounded-sm; }` (or raw CSS `button { border-radius: 0.125rem; }`) to `app/globals.css`. This sweeps every button at once.
  - Override per-button where a different radius is intentional (e.g. the arrow buttons already use `rounded-full` — those stay).
- All `<input>` and `<textarea>` elements: same approach as buttons in `globals.css`.

**Untouched.**
- Image container borders (`border border-bone aspect-square`) — stay sharp. The user wants chrome softened, not the artwork frame.
- Catalogue and home cards — outer card outline stays sharp; buttons inside soften via the global rule.
- Section dividers (`.gold-divider`) — straight line, no radius involved.

**Verification of "subtle, not bubbly":** 2px on a desktop monitor is roughly one rounded pixel at the corner — visible only on close inspection but cumulatively reads as "less pointy" across the page. If after implementation this feels too subtle, the value is in one place (`globals.css`) and trivially adjustable to 3-4px.

## Implementation notes & risks

- **Boundary-crossing perceived smoothness depends on prefetch.** Without `router.prefetch`, the first cross to a new variant on a slow connection could pause ~300ms. The mount-time prefetch covers this. Verify in DevTools that variant pages are fetched from cache during cross.
- **`ProductImage` placeholder behavior.** Implementation must verify `ProductImage` renders cleanly when `src === ''`. Most likely it already does (the component is used in catalogue cards where missing images already happen), but confirm before declaring Unit 1 done.
- **Lightbox + `useRouter` inside a portal.** `useRouter` should still work — portals don't break React context. Confirm during implementation.
- **The two-layer crossfade pattern is repeated** in `ProductGallery` (inline) and `ProductLightbox` (fullscreen). Consider extracting a `<CrossfadeImage items, activeIdx />` component once both work. Don't pre-factor — write twice, then unify when both behaviors are stable.
- **Group sort order is the existing `getProductVariants` order** (sort by `id`). The flat list inherits this. If product owners reorder variants later, the flat list reorders automatically.
- **Wrap-around at the ends of the flat list crosses variant boundaries** (last image of last variant → first image of first variant). This is consistent with the rest of the navigation; users who hold `→` will cycle through the entire group and end up where they started.

## Verification

A human (or implementing agent) confirms each:

1. **Photo wipe.** `public/images/products/` is empty; loading any product detail page shows the placeholder image without console errors; the catalogue grid shows placeholders uniformly. `data/products.json` validates as JSON; spot-check three products (one solo, one grouped, one with previous `images[]` array) and confirm all image fields are cleared.
2. **Crossfade.** On any product detail page with placeholder images, clicking the `<` / `>` arrows does not flash — the swap is a 200ms opacity transition.
3. **Variant flat-nav.** On a grouped product (e.g. Sosum), pressing `>` from the last image of the active variant lands on the next variant's first image, with: URL changed in address bar, price panel updated, `VariantSelector` highlight moved to the new variant. No visible page reload or flash.
4. **Wrap-around.** Holding `>` cycles through the entire group's flat list and returns to the start.
5. **Lightbox.** Clicking the main image opens the fullscreen modal. `<`/`>` arrows inside the lightbox navigate the same flat list (including variant boundaries — URL updates while modal stays open). Esc / backdrop-click / close button each close the modal. Body scroll is locked while open and restored on close.
6. **Edge softening.** Header buttons, badges (New / Sale / Best), and form inputs show a barely-perceptible rounded corner. Image frames and card outlines remain sharp. Visual diff vs. main branch on the home page, catalogue, and detail page is "softer but not bubbly."

## Open questions

None. All design decisions resolved during brainstorming.
