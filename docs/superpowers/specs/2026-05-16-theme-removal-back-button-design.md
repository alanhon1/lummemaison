# Spec 1: Theme System Removal + Prominent Back Button

**Date**: 2026-05-16
**Status**: Approved (awaiting plan)
**Scope batch**: 1 of 4 (Lumière post-launch improvements)

## Background

User requested 8 independent changes to the live B2B catalog (`lumiere-app`). To keep specs reviewable and decoupled, the work is split into 4 spec batches. This is batch 1 — pure cleanup + a small UX improvement, with no external scraping or data work.

The remaining batches (not in scope here):
- **Spec 2** — data enrichment (missing images, descriptions, mismatch detection, bundle name normalization)
- **Spec 3** — group/bundle catalog UX + product gallery navigation + home page sparkle effect
- **Spec 4** — product description / specification translation pipeline

## Goals

1. **Remove the multi-theme system entirely.** Keep only the default "classic" (Lumière) brand styling, baked in as the single visual identity. No theme switcher, no `data-theme` overrides.
2. **Add a prominent, category-aware back button** to the top of each product detail page that returns the user to the catalogue page they came from.

## Non-goals (YAGNI)

- Adding back buttons to category list pages — header navigation suffices.
- Clearing the `lumiere-theme` localStorage key from user browsers. The orphan key is harmless; the new code never reads it.
- Refactoring CSS variable usage. The 86 `var(--xxx)` references throughout the codebase keep working because the `:root` block defining them stays intact.
- Any of the other 7 user requests (covered by Spec 2–4).

## Current state (verified 2026-05-16)

- Theme files: `lib/theme-store.ts`, `components/ui/ThemeProvider.tsx`, `components/ui/ThemeToggle.tsx`.
- `ThemeProvider` is rendered in `app/layout.tsx` (line 41) and toggles a `data-theme` attribute on `<html>`.
- `ThemeToggle` is rendered in `components/layout/Header.tsx` twice: desktop nav (lines 119–126) and mobile nav (lines 227–229).
- `app/globals.css` has three layers:
  - `@theme { ... }` block (lines 3–25) — Tailwind brand tokens. **Keep.**
  - `:root { ... }` block (lines 27–41) — classic theme CSS variables. **Keep** (this becomes the only theme).
  - `[data-theme="neon"]` block (lines 43–68) and `[data-theme="paris"]` block (lines 70–94). **Delete.**
- Product detail page (`app/[locale]/product/[id]/page.tsx`) already has:
  - Breadcrumb at top (lines 47–61): Home / Catalogue / Category / Product Name.
  - "← Back to Catalogue" link at bottom (lines 163–171).
  - User feedback: not prominent enough; wants a big button at the top above the product image, with category-aware destination.

## Design

### Part A — Theme removal

**Delete** (3 files):
- `lib/theme-store.ts`
- `components/ui/ThemeProvider.tsx`
- `components/ui/ThemeToggle.tsx`

**Edit `app/layout.tsx`**:
- Remove `import ThemeProvider from "@/components/ui/ThemeProvider";` (line 4).
- Remove `<ThemeProvider />` (line 41).

**Edit `components/layout/Header.tsx`**:
- Remove `import ThemeToggle from '@/components/ui/ThemeToggle';` (line 11).
- Remove desktop ThemeToggle wrapper (lines 120–126).
- Remove mobile ThemeToggle wrapper (lines 227–229).

**Edit `app/globals.css`**:
- Delete the entire `[data-theme="neon"] { ... }` block (lines 43–68).
- Delete the entire `[data-theme="paris"] { ... }` block (lines 70–94).
- Leave the `:root` block (lines 27–41) and `@theme` block (lines 3–25) intact.

After these changes, the page never receives a `data-theme` attribute, so `:root` variables always apply — visual result identical to the current classic theme.

### Part B — Prominent back button

**New file**: `components/catalogue/BackToCatalogueButton.tsx`

Client component. Props: `locale: string`, `currentCategoryId: string` (the category of the product being viewed — used as fallback label).

Behavior on mount:
1. Read `document.referrer`. Parse as URL.
2. If referrer is same origin AND pathname matches `/{anyLocale}/catalogue/{categoryId}` → set `href = /{currentLocale}/catalogue/{categoryId}` and resolve the category name for the label. Locale is normalized to the current locale (so a user who came from `/en/catalogue/fillers` and switched to KO still gets back to `/ko/catalogue/fillers`).
3. Otherwise (referrer empty, external, or not a category page) → `href = /{currentLocale}/catalogue`, label = "Back to Catalogue".
4. Render a button-styled `<Link>` at the top of the page, above the image grid.

**Visual style**: text-sm, font-semibold, uppercase tracking, gold accent on hover, leading `ArrowLeft` icon (lucide-react, same icon used elsewhere). Sized to be clearly tappable (~py-3 px-4).

**Label format**:
- Specific: `← Back to Fillers` (or whatever the matched category name is, from `getCategoryById`)
- Fallback: `← Back to Catalogue`

**Edit `app/[locale]/product/[id]/page.tsx`**:
- Import the new `BackToCatalogueButton`.
- Insert `<BackToCatalogueButton locale={locale} currentCategoryId={product.categoryId} />` immediately inside the container `<div className="max-w-7xl mx-auto px-6 py-12">`, before the breadcrumb `<nav>`.
- Delete the duplicate "Back to Catalogue" link at the bottom (lines 163–171, including the wrapping `<div className="mt-12">`).

### Category-name resolution (i18n note)

`getCategoryById` returns the category from `data/products.json` with its `name` field in English (e.g. "Fillers", "Mesotherapy / Biorevitalization / HA"). The label will display this English name regardless of current locale. **This is intentional for Spec 1** — product description / specification translation is Spec 4's concern, and category names are short brand-y terms. Revisit in Spec 4 if needed.

### Edge cases

| Case | Behavior |
|---|---|
| Direct URL hit (no referrer) | `→ /catalogue`, label "Back to Catalogue" |
| Came from another product page | `→ /catalogue`, label "Back to Catalogue" |
| Came from cross-origin link (Google, WhatsApp) | `→ /catalogue`, label "Back to Catalogue" |
| Referrer is `/{locale}/catalogue` (no category) | `→ /catalogue`, label "Back to Catalogue" |
| Referrer category doesn't match a known categoryId | `→ /catalogue`, label "Back to Catalogue" |
| User had `lumiere-theme=neon` in localStorage | Site renders normally with classic styling — orphan key ignored |

### File summary

| Action | File | Lines |
|---|---|---|
| delete | `lib/theme-store.ts` | full file |
| delete | `components/ui/ThemeProvider.tsx` | full file |
| delete | `components/ui/ThemeToggle.tsx` | full file |
| edit | `app/layout.tsx` | remove lines 4, 41 |
| edit | `components/layout/Header.tsx` | remove lines 11, 120–126, 227–229 |
| edit | `app/globals.css` | delete lines 43–68 and 70–94 |
| edit | `app/[locale]/product/[id]/page.tsx` | add import + button at top, delete lines ~163–171 |
| new | `components/catalogue/BackToCatalogueButton.tsx` | client component |

Net: ~150 lines deleted, ~60 lines added.

## Testing

`npm run build` must pass clean (30 pages).

Manual verification on dev server (`npm run dev`):
1. Catalogue main `/catalogue` → click any product → back button reads "Back to Catalogue" → click → land on `/catalogue`.
2. Category page `/catalogue/fillers` → click any product → back button reads "Back to Fillers" → click → land on `/catalogue/fillers`.
3. Direct URL `/product/1` (paste into address bar) → back button reads "Back to Catalogue" → click → land on `/catalogue`.
4. From product → click a related product card → back button on the new page reads "Back to Catalogue" (referrer was product, not category).
5. Header: no Theme toggle visible on desktop or in mobile menu drawer.
6. Pre-set `localStorage.setItem('lumiere-theme', 'neon')` in devtools → reload any page → site renders in classic styling, no console error.
7. Switch locale (EN ↔ KO ↔ RU) on a product page → back button still works and stays in current locale.

## Open questions

None.

## Out of scope (re-confirmed)

The other seven user requests (data enrichment, mismatch checking, bundle renaming, group/bundle catalog UI, gallery `< >` controls, home page sparkle effect, description/spec translation) are tracked for Specs 2–4 and explicitly excluded from this spec.
