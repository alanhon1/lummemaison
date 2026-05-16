# Theme Removal + Prominent Back Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the multi-theme system entirely (keep classic only) and add a prominent category-aware back button to the top of product detail pages.

**Architecture:** Pure cleanup + one new client component. The new `BackToCatalogueButton` reads `document.referrer` to determine where to send users back. Theme removal deletes three source files, two CSS blocks, and edits two consumer files. No new dependencies. No data migrations.

**Tech Stack:** Next.js 16.2.6 (App Router, `[locale]` segment via next-intl), React 19, Tailwind CSS 4, TypeScript 5, lucide-react icons. No test framework — verification is `npm run build`, `npm run lint`, and manual browser testing on `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-05-16-theme-removal-back-button-design.md`

**Approach note:** Tasks 1–2 add the new back button **first** so the page remains fully functional with the existing Back-to-Catalogue link at the bottom during the transition. Tasks 3–6 then remove theme code in dependency order — each commit leaves the build green:
- Task 3 unwires `ThemeToggle` from `Header` (the only consumer)
- Task 4 unwires `ThemeProvider` from `app/layout.tsx`
- Task 5 deletes the theme CSS blocks (independent — `:root` block remains)
- Task 6 deletes the three orphan source files

---

## Task 1: Create the BackToCatalogueButton client component

**Files:**
- Create: `components/catalogue/BackToCatalogueButton.tsx`

**Why this component:** It needs `document.referrer` (browser API), so it must be a client component. The parent product page is a server component, so the categories lookup table is passed in as a prop rather than imported (server-only data isn't available to client components, but a plain serialisable object is fine to pass through).

- [ ] **Step 1: Create the file with the component**

Write the full contents to `components/catalogue/BackToCatalogueButton.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackToCatalogueButtonProps {
  locale: string;
  categoriesById: Record<string, string>;
}

interface BackTarget {
  href: string;
  label: string;
}

export default function BackToCatalogueButton({
  locale,
  categoriesById,
}: BackToCatalogueButtonProps) {
  const [target, setTarget] = useState<BackTarget>({
    href: `/${locale}/catalogue`,
    label: 'Back to Catalogue',
  });

  useEffect(() => {
    const referrer = document.referrer;
    if (!referrer) return;

    let url: URL;
    try {
      url = new URL(referrer);
    } catch {
      return;
    }

    if (url.origin !== window.location.origin) return;

    // Match /{anyLocale}/catalogue/{categoryId}
    const match = url.pathname.match(/^\/[^/]+\/catalogue\/([^/]+)\/?$/);
    if (!match) return;

    const categoryId = match[1];
    const categoryName = categoriesById[categoryId];
    if (!categoryName) return;

    setTarget({
      href: `/${locale}/catalogue/${categoryId}`,
      label: `Back to ${categoryName}`,
    });
  }, [locale, categoriesById]);

  return (
    <Link
      href={target.href}
      className="inline-flex items-center gap-2 mb-6 px-4 py-3 text-sm font-semibold tracking-wider uppercase text-charcoal hover:text-gold transition-colors duration-300 border border-bone hover:border-gold rounded-md"
    >
      <ArrowLeft size={16} />
      {target.label}
    </Link>
  );
}
```

- [ ] **Step 2: Verify the file type-checks via build**

Run: `npm run build`
Expected: `Compiled successfully`, no TypeScript errors. (Next.js 16 may print prerender output for ~30 pages — that's fine.)

- [ ] **Step 3: Commit**

```
git add components/catalogue/BackToCatalogueButton.tsx
git commit -m "feat: add BackToCatalogueButton client component"
```

---

## Task 2: Wire BackToCatalogueButton into product detail page; remove duplicate bottom link

**Files:**
- Modify: `app/[locale]/product/[id]/page.tsx` (3 edits: import, insert button, remove bottom link)

- [ ] **Step 1: Add the import**

Open `app/[locale]/product/[id]/page.tsx`.

Find this block of imports (around lines 1-12):

```tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Tag, Layers } from 'lucide-react';
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants } from '@/lib/products';
import { getTranslations } from 'next-intl/server';
import ProductDetailClient from '@/components/catalogue/ProductDetailClient';
import ProductDetailTabs from '@/components/catalogue/ProductDetailTabs';
import ProductPrice from '@/components/catalogue/ProductPrice';
import ProductCard from '@/components/catalogue/ProductCard';
import ProductGallery from '@/components/catalogue/ProductGallery';
import VariantSelector from '@/components/catalogue/VariantSelector';
```

Add two new imports right after the existing `@/lib/products` import. Also add the `categories` named export to the existing destructured import:

Replace:
```tsx
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants } from '@/lib/products';
```

With:
```tsx
import { getProductById, getCategoryById, getProductsByCategory, getProductVariants, categories } from '@/lib/products';
```

Then add after the `VariantSelector` import line:
```tsx
import BackToCatalogueButton from '@/components/catalogue/BackToCatalogueButton';
```

- [ ] **Step 2: Insert the back button at the top of the page container**

Find the start of the returned JSX (around line 43-46):

```tsx
return (
  <div className="pt-24 min-h-screen bg-cream">
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-mist mb-8">
```

Build the categories lookup inside the function (after the `variants` and `hasEnriched` lines, before the `return`):

```tsx
  const categoriesById: Record<string, string> = Object.fromEntries(
    categories.map(c => [c.id, c.name])
  );
```

Then insert the back button as the first child of the `max-w-7xl` div, before the breadcrumb:

```tsx
return (
  <div className="pt-24 min-h-screen bg-cream">
    <div className="max-w-7xl mx-auto px-6 py-12">
      <BackToCatalogueButton locale={locale} categoriesById={categoriesById} />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-mist mb-8">
```

- [ ] **Step 3: Remove the duplicate bottom Back-to-Catalogue link**

Find this block near the end of the file (around lines 163-171):

```tsx
        <div className="mt-12">
          <Link
            href={`/${locale}/catalogue`}
            className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-mist hover:text-gold transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Catalogue
          </Link>
        </div>
```

Delete the entire `<div className="mt-12">...</div>` block.

After deletion, check whether `Link` and `ArrowLeft` are still used elsewhere in the file. `Link` is still used in the breadcrumb — keep it. `ArrowLeft` is no longer used anywhere in this file — remove it from the lucide-react import:

Replace:
```tsx
import { ArrowLeft, Tag, Layers } from 'lucide-react';
```

With:
```tsx
import { Tag, Layers } from 'lucide-react';
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: `Compiled successfully`. No "unused import" or TypeScript errors.

- [ ] **Step 5: Manual smoke test of the back button**

Start dev server: `npm run dev` (run in background, leave it running)

In a browser at `http://localhost:3000`:

1. Navigate to `/en/catalogue/fillers`. Click any product card. On the product detail page, the back button at the top should read **"Back to Fillers"**. Click it — should land back on `/en/catalogue/fillers`.
2. Navigate to `/en/catalogue` (the main catalogue page). Click any product card. Back button should read **"Back to Catalogue"**. Click it — should land on `/en/catalogue`.
3. Open a new tab and paste `http://localhost:3000/en/product/1` directly. Back button should read **"Back to Catalogue"**. Click it — should land on `/en/catalogue`.
4. From a product page, click a related product card at the bottom. New page's back button should read **"Back to Catalogue"** (referrer was a product, not a category).

If any of these fail, debug before commit. The most likely failure is the regex pathname match — check `document.referrer` in DevTools to confirm what referrer value the browser is sending.

- [ ] **Step 6: Commit**

```
git add app/[locale]/product/[id]/page.tsx
git commit -m "feat: replace bottom catalogue link with prominent top back button"
```

---

## Task 3: Remove ThemeToggle from Header

**Files:**
- Modify: `components/layout/Header.tsx` (3 edits)

- [ ] **Step 1: Remove the ThemeToggle import**

Open `components/layout/Header.tsx`. Delete line 11:

```tsx
import ThemeToggle from '@/components/ui/ThemeToggle';
```

- [ ] **Step 2: Remove the desktop ThemeToggle wrapper**

Find this block (around lines 120-126):

```tsx
            {/* Theme toggle */}
            <div
              className="hidden lg:flex"
              style={{ color: 'var(--page-text)' }}
            >
              <ThemeToggle />
            </div>
```

Delete the entire block including the `{/* Theme toggle */}` comment.

- [ ] **Step 3: Remove the mobile ThemeToggle wrapper**

Find this block in the mobile menu (around lines 227-229):

```tsx
              <div style={{ color: 'var(--page-text)' }}>
                <ThemeToggle />
              </div>
```

Delete it.

- [ ] **Step 4: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`. No "ThemeToggle not defined" errors and no unused-import warnings.

- [ ] **Step 5: Manual check — header is clean**

If the dev server from Task 2 is still running, refresh the page. Otherwise: `npm run dev`.

On any page:
- Desktop view (≥1024px wide): no Theme palette icon between Currency and Globe icons.
- Mobile view (resize browser or DevTools device mode): open the hamburger menu — no Theme button in the bottom row alongside locale and currency buttons.

- [ ] **Step 6: Commit**

```
git add components/layout/Header.tsx
git commit -m "refactor: remove ThemeToggle from header (desktop + mobile)"
```

---

## Task 4: Remove ThemeProvider from root layout

**Files:**
- Modify: `app/layout.tsx` (2 edits — both deletions)

- [ ] **Step 1: Remove the import**

Open `app/layout.tsx`. Delete line 4:

```tsx
import ThemeProvider from "@/components/ui/ThemeProvider";
```

- [ ] **Step 2: Remove the component instance**

Find this line in the `<body>` (around line 41):

```tsx
        <ThemeProvider />
```

Delete it.

After deletion, the body should look like:

```tsx
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`. No errors.

- [ ] **Step 4: Manual sanity check**

Refresh any page in the dev server. Visual styling should be **unchanged** (classic Lumière cream + gold). The `:root` block in `globals.css` provides all CSS variables; nothing depends on a `data-theme` attribute being set anymore.

If the page suddenly looks wrong (e.g. colors broken), stop — `globals.css` `:root` block may have been damaged. Restore and investigate.

- [ ] **Step 5: Commit**

```
git add app/layout.tsx
git commit -m "refactor: remove ThemeProvider from root layout"
```

---

## Task 5: Delete theme CSS blocks from globals.css

**Files:**
- Modify: `app/globals.css` (delete two `[data-theme="..."]` blocks, ~52 lines)

- [ ] **Step 1: Delete the `[data-theme="neon"]` block**

Open `app/globals.css`. Find the `/* ─── Neon Violet ─── */` comment (around line 43) and the entire block that follows:

```css
/* ─── Neon Violet ─── */
[data-theme="neon"] {
  --glass-bg:     rgba(8, 6, 20, 0.92);
  --glass-border: rgba(168, 85, 247, 0.25);
  --accent:       #a855f7;
  --accent-dark:  #7c3aed;
  --glow:         0 0 20px rgba(168, 85, 247, 0.35), 0 0 50px rgba(168, 85, 247, 0.15);
  --card-shadow:  0 8px 30px rgba(168, 85, 247, 0.12);
  --surface:      #100e24;
  --surface-dark: #06050f;
  --page-bg:      #08061a;
  --page-text:    #ede9ff;
  --page-text-2:  #9d8fc9;
  --border-color: #1e1a3a;
  /* Override Tailwind color vars for utility adaptation */
  --color-cream:    #08061a;
  --color-cream-dark: #100e24;
  --color-gold:     #a855f7;
  --color-gold-light: #c084fc;
  --color-gold-dark: #7c3aed;
  --color-obsidian: #ede9ff;
  --color-charcoal: #d0c8ff;
  --color-mist:     #9d8fc9;
  --color-bone:     #1e1a3a;
  --color-surface:  #100e24;
}
```

Delete the entire comment line plus the entire block including its closing `}` and trailing blank line.

- [ ] **Step 2: Delete the `[data-theme="paris"]` block**

Find the `/* ─── Soir de Paris (Midnight Navy) ─── */` comment and the block that follows:

```css
/* ─── Soir de Paris (Midnight Navy) ─── */
[data-theme="paris"] {
  --glass-bg:     rgba(6, 9, 20, 0.92);
  --glass-border: rgba(201, 169, 110, 0.18);
  --accent:       #c9a96e;
  --accent-dark:  #a8874a;
  --glow:         none;
  --card-shadow:  0 8px 30px rgba(0, 0, 0, 0.25);
  --surface:      #0d1428;
  --surface-dark: #040810;
  --page-bg:      #070c18;
  --page-text:    #ede8db;
  --page-text-2:  #8a8070;
  --border-color: #182040;
  --color-cream:    #070c18;
  --color-cream-dark: #0d1428;
  --color-gold:     #c9a96e;
  --color-gold-light: #ddc08e;
  --color-gold-dark: #a8874a;
  --color-obsidian: #ede8db;
  --color-charcoal: #ccc2b0;
  --color-mist:     #8a8070;
  --color-bone:     #182040;
  --color-surface:  #0d1428;
}
```

Delete the entire comment line plus the entire block.

After both deletions, the file should flow directly from the `:root { ... }` block to the `/* ─── Base ─── */` comment with `@layer base`.

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`. No CSS errors.

- [ ] **Step 4: Manual sanity check**

Refresh any page. Visual styling unchanged.

In DevTools Elements panel, check the `<html>` tag — it should NOT have a `data-theme` attribute (was already true after Task 4, but confirming).

- [ ] **Step 5: Commit**

```
git add app/globals.css
git commit -m "refactor: delete neon and paris theme CSS blocks"
```

---

## Task 6: Delete the three orphan theme source files

**Files:**
- Delete: `lib/theme-store.ts`
- Delete: `components/ui/ThemeProvider.tsx`
- Delete: `components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Sanity-check nothing still references these files**

Run a search to confirm no remaining imports:

```
git grep -n "from '@/lib/theme-store'"
git grep -n "from '@/components/ui/ThemeProvider'"
git grep -n "from '@/components/ui/ThemeToggle'"
git grep -n "ThemeToggle"
git grep -n "ThemeProvider"
git grep -n "useThemeStore"
```

Expected: zero matches across all six searches (the grep commands return non-zero exit code when no match — that's the desired outcome).

If any match appears, stop and clean up that reference before deleting files.

- [ ] **Step 2: Delete the three files**

```
git rm lib/theme-store.ts
git rm components/ui/ThemeProvider.tsx
git rm components/ui/ThemeToggle.tsx
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`
Expected: `Compiled successfully`. No "module not found" errors.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no errors (warnings about unrelated existing code are acceptable, but no new errors introduced by the deletions).

- [ ] **Step 5: Commit**

```
git commit -m "refactor: delete orphan theme source files (theme-store, ThemeProvider, ThemeToggle)"
```

---

## Task 7: Final end-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: `Compiled successfully` with all 30 pages prerendering successfully.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors introduced by this work.

- [ ] **Step 3: Full manual walkthrough on dev server**

Start `npm run dev` if not already running. In a browser at `http://localhost:3000`:

1. **Theme removed — desktop**: at desktop width, header has Search / Currency / Globe / Cart icons but no palette/Theme icon between Currency and Globe. ✓
2. **Theme removed — mobile**: resize to mobile, open hamburger menu, bottom row has locale buttons + currency button but no Theme button. ✓
3. **Visual identity unchanged**: cream background, gold accents, serif headings — looks identical to before. ✓
4. **Back button — from category**: navigate to `/en/catalogue/fillers`, click any product. Top of detail page shows large "← Back to Fillers" button. Click — lands on `/en/catalogue/fillers`. ✓
5. **Back button — from main catalogue**: navigate to `/en/catalogue`, click any product. Top of detail page shows "← Back to Catalogue". Click — lands on `/en/catalogue`. ✓
6. **Back button — direct URL**: open `/en/product/1` directly in a new tab. Back button reads "← Back to Catalogue". Click — lands on `/en/catalogue`. ✓
7. **Back button — locale-aware**: on a product page reached from `/ko/catalogue/fillers`, switch locale to EN via header. Back button still works and lands on `/en/catalogue/fillers` (current locale). ✓
8. **No duplicate bottom link**: scroll to the bottom of the product detail page — there should be no second "Back to Catalogue" link below the related products. (Related products grid is the last content block.) ✓
9. **Cross-category referrer**: from `/en/catalogue/fillers`, click a product. From that product page, click a related product card (likely also Fillers). On the new page, back button reads "← Back to Catalogue" — because referrer was a product page, not a category page. ✓
10. **localStorage orphan key**: open DevTools console, run `localStorage.setItem('lumiere-theme', 'neon')`, refresh the page. Page renders in classic styling, no console errors. Orphan key is harmless. ✓

- [ ] **Step 4: Stop the dev server** (Ctrl-C in the terminal running it).

- [ ] **Step 5: Final git log check**

Run: `git log --oneline -10`
Expected: see the 6 commits from Tasks 1, 2, 3, 4, 5, 6 in order on top of the prior `docs:` spec commit.

No code commit needed for this task — it is a verification gate. If anything failed in Step 3, return to the relevant task and fix.

---

## Done criteria

- [ ] All 7 tasks complete with green build and lint.
- [ ] All 10 manual checks in Task 7 pass.
- [ ] `git log` shows 6 clean commits plus the spec commit.
- [ ] No `Theme*` symbols or `[data-theme=` selectors remain in the codebase (`git grep -i theme` outside `node_modules` and `docs/superpowers/` should only show test/comment references, if any).
