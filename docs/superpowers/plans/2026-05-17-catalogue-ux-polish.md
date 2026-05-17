# Catalogue UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Bundles" sidebar entry and per-category "Group only" toggle, extend search to recognise group names, overlay arrow controls on the product gallery, and add gold sparkle particles to the home hero.

**Architecture:** Five surgical UI changes across three files. Three of them modify `components/catalogue/CatalogueClient.tsx` (the bundles entry, the group-only toggle, the Fuse search keys). One modifies `components/catalogue/ProductGallery.tsx` (arrow controls + keyboard handler). One modifies `components/home/Hero.tsx` (sparkle layer). No new files. No new dependencies — `framer-motion` and `lucide-react` are already used by the touched files.

**Tech Stack:** Next.js 16.2.6, React 19, TypeScript 5, Tailwind CSS 4, Fuse.js (already installed), framer-motion (already installed), lucide-react (already installed). No test framework — verification = `npm run build` + `npm run lint` + manual browser check on `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-05-17-catalogue-ux-polish-design.md` (commit `0888ebe`)

---

## File Structure

**Modified files (no new files):**
- `components/catalogue/CatalogueClient.tsx` — Units 1, 2, 3 (Bundles entry, Group-only toggle, search keys)
- `components/catalogue/ProductGallery.tsx` — Unit 4 (arrow controls + keyboard handler)
- `components/home/Hero.tsx` — Unit 5 (sparkle particles)

Tasks 1-3 all touch `CatalogueClient.tsx` and are sequenced as three separate commits for review clarity. Tasks 4 and 5 are each one commit on their own file.

---

## Task 1: Bundles sidebar entry + filter branch

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

This task adds the sentinel-based "Bundles" filter and the corresponding sidebar entry. The catalogue already deduplicates grouped products in its filter pipeline — Task 1 only adds a new branch that narrows to grouped products before that dedupe step does its job.

- [ ] **Step 1: Add the bundles branch into the filter pipeline**

Open `components/catalogue/CatalogueClient.tsx`. Find the category filter block (around lines 63-66):

```tsx
    // Category filter
    if (activeCategory) {
      result = result.filter(p => p.categoryId === activeCategory);
    }
```

Replace with:

```tsx
    // Category filter (Bundles sentinel narrows to grouped products only)
    if (activeCategory === '__bundles__') {
      result = result.filter(p => Boolean(p.groupId));
    } else if (activeCategory) {
      result = result.filter(p => p.categoryId === activeCategory);
    }
```

- [ ] **Step 2: Add the "Bundles" entry above the category list in the sidebar**

Find the sidebar's categories section (around lines 162-200):

```tsx
          {/* Categories */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
              {t('allCategories')}
            </h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => handleCategoryClick('')}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    !activeCategory
                      ? 'bg-obsidian text-cream font-semibold'
                      : 'text-charcoal hover:text-gold hover:bg-cream'
                  }`}
                >
                  All Categories
                  <span className="float-right text-xs opacity-50">{products.length}</span>
                </button>
              </li>
              {categories.map(cat => {
```

Insert a new `<li>` for Bundles **between** the "All Categories" `<li>` and the `{categories.map(...)}` block. Also compute the bundle count once (above the `<ul>`).

After the `<h3>` line and before the `<ul>` line, add a memoized bundle count via a local `const`:

```tsx
            <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
              {t('allCategories')}
            </h3>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => handleCategoryClick('')}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    !activeCategory
                      ? 'bg-obsidian text-cream font-semibold'
                      : 'text-charcoal hover:text-gold hover:bg-cream'
                  }`}
                >
                  All Categories
                  <span className="float-right text-xs opacity-50">{products.length}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleCategoryClick('__bundles__')}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    activeCategory === '__bundles__'
                      ? 'bg-gold text-white font-semibold'
                      : 'text-charcoal hover:text-gold hover:bg-cream'
                  }`}
                >
                  Bundles
                  <span className="float-right text-xs opacity-50">{variantCounts.size}</span>
                </button>
              </li>
              {categories.map(cat => {
```

`variantCounts.size` is the number of distinct groups (33), already computed by the existing `useMemo` at lines 45-53. No extra computation needed.

- [ ] **Step 3: Update the "Viewing:" badge to label the bundles view**

Find the active-category badge block (around lines 319-330):

```tsx
          {/* Active category badge */}
          {activeCategory && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-bone">
              <span className="text-xs text-mist">Viewing:</span>
              <span className="text-xs font-semibold text-gold">
                {categories.find(c => c.id === activeCategory)?.name}
              </span>
```

Replace the `<span className="text-xs font-semibold text-gold">` content to handle the bundles sentinel:

```tsx
              <span className="text-xs font-semibold text-gold">
                {activeCategory === '__bundles__'
                  ? 'Bundles'
                  : categories.find(c => c.id === activeCategory)?.name}
              </span>
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: `Compiled successfully`, 38 pages.

- [ ] **Step 5: Manual sanity check**

Start dev server if not already running: `npm run dev`. Open `http://localhost:3000/en/catalogue`.

Verify:
- Sidebar shows "All Categories", then "Bundles (33)", then the 20 categories.
- Click "Bundles" — grid shows 33 cards (one per group). All cards show group names (Sosum, Regenovue, etc).
- The "Viewing: Bundles" badge appears at the top of the main content area.
- Click "Bundles" again — returns to All Categories.

- [ ] **Step 6: Commit**

```
git add components/catalogue/CatalogueClient.tsx
git commit -m "feat(catalogue): add Bundles sidebar entry and __bundles__ filter sentinel"
```

---

## Task 2: "Bundle products only" toggle

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

A third boolean filter (`groupedOnly`) joins the existing `saleOnly` and `newOnly`. Composes with whichever category is active. Hidden when the Bundles view is active (would be redundant there).

- [ ] **Step 1: Add the state**

Find the state declarations (around lines 32-40):

```tsx
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(initialCategory || '');
  const [saleOnly, setSaleOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
```

Insert a new state after `newOnly`:

```tsx
  const [saleOnly, setSaleOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [groupedOnly, setGroupedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('default');
```

- [ ] **Step 2: Add the filter step**

Find the New filter block in the filter pipeline (around lines 74-76):

```tsx
    // New filter
    if (newOnly) {
      result = result.filter(p => p.isNew);
    }
```

Insert a new filter immediately after (still before the sort switch):

```tsx
    // New filter
    if (newOnly) {
      result = result.filter(p => p.isNew);
    }

    // Group-only filter (applies in addition to any active category)
    if (groupedOnly) {
      result = result.filter(p => Boolean(p.groupId));
    }
```

- [ ] **Step 3: Add `groupedOnly` to the filter pipeline's dependency array**

Find the closing `useMemo` for `filteredProducts` (around line 101):

```tsx
  }, [searchQuery, activeCategory, saleOnly, newOnly, sortBy, fuse]);
```

Replace with:

```tsx
  }, [searchQuery, activeCategory, saleOnly, newOnly, groupedOnly, sortBy, fuse]);
```

- [ ] **Step 4: Include in `clearFilters` and `hasActiveFilters`**

Find `clearFilters` (around lines 122-129):

```tsx
  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('');
    setSaleOnly(false);
    setNewOnly(false);
    setSortBy('default');
    setPage(1);
  };
```

Replace with:

```tsx
  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('');
    setSaleOnly(false);
    setNewOnly(false);
    setGroupedOnly(false);
    setSortBy('default');
    setPage(1);
  };
```

Find `hasActiveFilters` (around line 131):

```tsx
  const hasActiveFilters = searchQuery || activeCategory || saleOnly || newOnly;
```

Replace with:

```tsx
  const hasActiveFilters = searchQuery || activeCategory || saleOnly || newOnly || groupedOnly;
```

- [ ] **Step 5: Add the toggle UI in the Quick Filters block**

Find the Quick Filters block (around lines 202-225):

```tsx
          {/* Quick Filters */}
          <div className="space-y-3 mb-8">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
              Quick Filters
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saleOnly}
                onChange={e => { setSaleOnly(e.target.checked); setPage(1); }}
                className="w-3 h-3 accent-gold"
              />
              <span className="text-xs text-charcoal">{t('saleOnly')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={e => { setNewOnly(e.target.checked); setPage(1); }}
                className="w-3 h-3 accent-gold"
              />
              <span className="text-xs text-charcoal">{t('newOnly')}</span>
            </label>
          </div>
```

Add a third toggle after the newOnly label, conditionally hidden when the Bundles view is active:

```tsx
          {/* Quick Filters */}
          <div className="space-y-3 mb-8">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-3">
              Quick Filters
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saleOnly}
                onChange={e => { setSaleOnly(e.target.checked); setPage(1); }}
                className="w-3 h-3 accent-gold"
              />
              <span className="text-xs text-charcoal">{t('saleOnly')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={e => { setNewOnly(e.target.checked); setPage(1); }}
                className="w-3 h-3 accent-gold"
              />
              <span className="text-xs text-charcoal">{t('newOnly')}</span>
            </label>
            {activeCategory !== '__bundles__' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupedOnly}
                  onChange={e => { setGroupedOnly(e.target.checked); setPage(1); }}
                  className="w-3 h-3 accent-gold"
                />
                <span className="text-xs text-charcoal">Bundle products only</span>
              </label>
            )}
          </div>
```

- [ ] **Step 6: Verify the build passes**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 7: Manual sanity check**

Refresh `/en/catalogue/fillers` on the dev server (or any non-Bundles category page).

Verify:
- Sidebar Quick Filters shows three checkboxes: "On sale", "New", "Bundle products only".
- Toggle "Bundle products only" → grid narrows to grouped products in Fillers (Sosum, Regenovue, Neuramis, etc.). Untoggle → restores.
- Switch to the Bundles view → the "Bundle products only" toggle disappears (redundant).
- The "Clear" link in the top bar appears when "Bundle products only" is active and clears it.

- [ ] **Step 8: Commit**

```
git add components/catalogue/CatalogueClient.tsx
git commit -m "feat(catalogue): add Bundle products only quick filter toggle"
```

---

## Task 3: Group-aware search (extend Fuse keys)

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

- [ ] **Step 1: Extend the Fuse key list**

Find `fuseOptions` (around lines 16-24):

```tsx
const fuseOptions = {
  threshold: 0.4,
  keys: [
    { name: 'name', weight: 2 },
    { name: 'specification', weight: 1 },
    { name: 'description', weight: 0.8 },
    { name: 'categoryId', weight: 0.5 },
  ],
};
```

Replace with:

```tsx
const fuseOptions = {
  threshold: 0.4,
  keys: [
    { name: 'name', weight: 2 },
    { name: 'groupName', weight: 1.5 },
    { name: 'specification', weight: 1 },
    { name: 'description', weight: 0.8 },
    { name: 'categoryId', weight: 0.5 },
    { name: 'groupId', weight: 0.3 },
  ],
};
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 3: Manual sanity check**

On the catalogue page, search for these terms (which were not reliably hitting before):
- `sosum` → Sosum group card appears at top
- `regenovue` → Regenovue group card appears at top
- `neuramis` → Neuramis group card appears at top
- `tesoro` → Tesoro group card appears at top

For each, the search should also still return any non-grouped products that mention the term.

- [ ] **Step 4: Commit**

```
git add components/catalogue/CatalogueClient.tsx
git commit -m "feat(catalogue): include groupName and groupId in Fuse search keys"
```

---

## Task 4: Gallery arrow controls + keyboard support

**Files:**
- Modify: `components/catalogue/ProductGallery.tsx`

Add left/right arrow buttons overlaying the main image, plus a keyboard listener for left/right arrow keys while the component is mounted.

- [ ] **Step 1: Import the chevron icons and useEffect**

Open `components/catalogue/ProductGallery.tsx`. The current imports (lines 1-4) are:

```tsx
'use client';

import { useState } from 'react';
import ProductImage from './ProductImage';
```

Replace with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductImage from './ProductImage';
```

- [ ] **Step 2: Add the keyboard handler effect**

Find the body of the `ProductGallery` function (around line 24, after `const [activeIdx, setActiveIdx] = useState(0);`):

```tsx
  const allImages = [mainImage, ...extraImages].filter(Boolean);
  const [activeIdx, setActiveIdx] = useState(0);

  return (
```

Insert a new `useEffect` between the state declaration and the `return`:

```tsx
  const allImages = [mainImage, ...extraImages].filter(Boolean);
  const [activeIdx, setActiveIdx] = useState(0);

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

  return (
```

- [ ] **Step 3: Add the arrow overlay buttons inside the main image container**

Find the main image container (around lines 29-46):

```tsx
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
```

Insert two arrow buttons inside that container, between the `{badges && ...}` block and the closing `</div>` of the main image container, rendered only when there are multiple images:

```tsx
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
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 5: Manual sanity check**

On the dev server, navigate to a product page that has multiple images (e.g. any of the SOSUM variants or another product with extras). You can find one via:

```bash
node -e "const d=require('./data/products.json'); const m=d.products.find(p=>p.images&&p.images.length>0); console.log('first multi-image product:', m.id, m.name);"
```

Then open `/en/product/{id}` for that product. Verify:
- Left and right arrow buttons overlay the main image (gold-on-charcoal circular buttons).
- Click each — main image cycles.
- Press left/right keyboard arrows — main image cycles.
- Existing thumbnail strip below still works (click any thumbnail to jump).
- For a product with ONLY one image, neither arrows nor thumbnails appear.

- [ ] **Step 6: Commit**

```
git add components/catalogue/ProductGallery.tsx
git commit -m "feat(catalogue): add arrow controls and keyboard nav to ProductGallery"
```

---

## Task 5: Home hero sparkle particles

**Files:**
- Modify: `components/home/Hero.tsx`

Add a `Sparkles` sub-component at the bottom of the file and render it inside the hero section after the three existing orbs.

- [ ] **Step 1: Add the Sparkles sub-component to the bottom of Hero.tsx**

Open `components/home/Hero.tsx`. After the closing `}` of the `Hero()` function (around line 146), append the new sub-component:

```tsx

function Sparkles() {
  const particles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    size: 4 + ((i * 0.8) % 8),
    top: `${15 + ((i * 17.3) % 75)}%`,
    left: `${30 + ((i * 23.1) % 65)}%`,
    delay: (i * 0.7) % 3.5,
    duration: 3 + ((i * 0.4) % 3),
  })), []);

  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-gold/40 blur-sm pointer-events-none"
          style={{ width: p.size, height: p.size, top: p.top, left: p.left }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.8, 1.2, 0.8], y: [0, -20, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 2: Import `useMemo` at the top of the file**

Hero.tsx currently does not import `useMemo`. The top imports look like:

```tsx
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
```

Add `useMemo` to a new React import after the `'use client';` line:

```tsx
'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
```

- [ ] **Step 3: Render `<Sparkles />` inside the hero section, after the three existing orbs**

Find the three existing animated orbs in the hero (around lines 24-38). Immediately after the third closing `/>` (the one for the `bg-gold/12 ... w-32 h-32` orb), before the `{/* Grid pattern */}` comment, insert:

```tsx
      {/* Sparkle particles */}
      <Sparkles />

      {/* Grid pattern */}
```

So the relevant section now reads:

```tsx
      <motion.div
        className="absolute top-1/2 right-1/3 w-32 h-32 bg-gold/12 rounded-full blur-2xl pointer-events-none"
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Sparkle particles */}
      <Sparkles />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 5: Manual visual check**

Refresh `http://localhost:3000/en` on the dev server.

Verify:
- The three existing gold orbs continue to drift slowly.
- 10 small gold sparkles appear scattered across the right half of the hero (avoiding the title text area on the left). Each fades in to ~70% opacity, scales up slightly, drifts upward, then fades out, restarting on its own staggered cycle.
- Clicking the CTA buttons ("Browse Catalogue", contact) still works — sparkles do not block clicks (they are `pointer-events-none`).
- The grid pattern overlay and existing scroll indicator are unaffected.

If the count feels overwhelming or sparse: in `Sparkles()`, change `{ length: 10 }` to `{ length: 6 }` or `{ length: 14 }` and re-check. The plan sets 10 as the default.

- [ ] **Step 6: Commit**

```
git add components/home/Hero.tsx
git commit -m "feat(home): add sparkle particle layer to hero alongside existing orbs"
```

---

## Task 6: Final verification

**Files:** none modified.

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: `Compiled successfully`, all 38 pages prerender.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: problem count at the pre-Spec-3 baseline of 69. No new errors introduced.

- [ ] **Step 3: End-to-end manual walk**

On the dev server:

1. `/en` — hero shows 3 orbs + 10 sparkles, CTAs clickable, no visual regressions.
2. `/en/catalogue` — sidebar shows "All Categories", "Bundles (33)", and the 20 categories. Quick Filters shows "On sale", "New", "Bundle products only".
3. Click "Bundles" — grid shows 33 cards with group names; "Bundle products only" toggle is hidden; "Viewing: Bundles" badge shows.
4. Click "All Categories" — grid restores. Click "Fillers" — grid filters to fillers; "Bundle products only" toggle reappears.
5. Toggle "Bundle products only" with Fillers active → grid narrows to grouped Fillers products (Sosum, Regenovue, Neuramis, etc.).
6. Search "sosum" → Sosum card at top. Search "regenovue" → Regenovue card at top. Search "neuramis" → Neuramis card at top.
7. Click any group card → variant detail page loads. Confirm:
   - Back button still works (Spec 1).
   - Group name + bundle image showed on the catalog card (Spec 2).
   - Gallery left/right arrows overlay main image; keyboard left/right cycles too (Spec 3).
8. Press the "Clear" link at the top of the catalogue — all filters reset (including "Bundle products only").
9. Switch between list and grid layout — group cards in both layouts use the group display fields (Spec 2 behavior intact).

- [ ] **Step 4: Final git log inspection**

Run: `git log --oneline 0888ebe..HEAD`

Expected: 5 commits, one per Unit:

```
<sha> feat(home): add sparkle particle layer to hero alongside existing orbs
<sha> feat(catalogue): add arrow controls and keyboard nav to ProductGallery
<sha> feat(catalogue): include groupName and groupId in Fuse search keys
<sha> feat(catalogue): add Bundle products only quick filter toggle
<sha> feat(catalogue): add Bundles sidebar entry and __bundles__ filter sentinel
```

No commit needed for this task — verification gate only.

---

## Done criteria

- [ ] All 6 tasks complete with green build and lint.
- [ ] All 9 manual checks in Task 6 Step 3 pass.
- [ ] No regressions in Spec 1 (back button) or Spec 2 (group display, audited images).
- [ ] `git log` shows 5 clean commits, one per Unit, plus the prior spec commit `0888ebe`.
