# Spec: Mobile-First Rework + Brand Cleanup + Scroll Performance

**Date**: 2026-05-27
**Status**: Approved (awaiting plan)

## Background

Three user-reported problems on the public site, addressed together because they touch the same surface (the entire public-facing storefront — home, catalogue, product detail, footer, header):

1. **Parent-company branding leaks through.** "SH Core Stetics Global" and "Skin Global" appear on Hero, Footer, About copy, and the footer copyright. The desired public identity is **Lumée Maison only.**
2. **Scrolling jank.** Hero ships 12 framer-motion orbs + 16 sparkle particles all looping continuously; `background-attachment: fixed` is set on `body`, `.luxe-bg`, and `.catalogue-luxe-bg`; header uses `backdrop-filter: blur(20px)` on every scroll frame. On mobile this combination is the dominant cost.
3. **Site is not mobile-optimised.** Catalogue grid is 1-column on phones (huge cards), Hero pads top to ~`pt-40` so the title sits below the fold, hover-only "quick add" overlays do nothing on touch, footer is a 4-column wall of text that becomes a long mobile scroll, product detail page has long protocol/description blocks with no progressive disclosure.

The user explicitly chose a **full rework** (over a targeted fix), so this spec covers the public site holistically — not the admin (`/manzura`) and not checkout/cart/payment.

## Goals

1. Remove every public surface mention of "SH Core Stetics Global" / "Skin Global" in favour of Lumée Maison.
2. Eliminate the scroll-performance bottlenecks (orb count, fixed backgrounds, mobile backdrop-blur) without abandoning the luxury aesthetic.
3. Rework header, hero, catalogue/product cards, product detail page, footer, and the home below-fold sections to be mobile-first — phone is the design target; desktop adapts up via `md:`/`lg:` modifiers.
4. Preserve the existing desktop design where possible. Desktop should look essentially unchanged at `lg:` and above.

## Non-goals (YAGNI)

- Checkout flow (`/cart`, `/checkout`, `/payment`) — separate spec if needed.
- Admin (`/manzura/*`) — internal tool, not user-facing.
- Product data changes (no JSON edits, no description rewriting).
- New routes, new locales, new currencies.
- Replacing framer-motion or Tailwind. Keep current stack.
- A native mobile app or PWA installability.
- Touch swipe gestures on the gallery (already covered by Spec 3's arrow controls).
- Renaming `siteConfig.companyName` to a real legal entity. The dual-brand legal structure is preserved internally; only public copy changes.

## Current state (verified 2026-05-27)

### Brand surfaces
- `lib/site-config.ts`: `companyName: "SH Core Stetics Global"`, `companyNameAlt: "Skin Global"`, `payment.wise.accountName: "SH Core Stetics Global"`.
- `components/home/Hero.tsx:81`: literal string `"SH Core Stetics Global"` as the uppercase tag above the title.
- `components/layout/Footer.tsx:22-23`: renders `siteConfig.companyName` + `(${siteConfig.companyNameAlt})` under the "Lumée Maison" wordmark.
- `messages/en.json:188`, `messages/ko.json:188`, `messages/ru.json:188`: `about.story.content` opens with "Lumée Maison is the global export brand of SH Core Stetics Global (Skin Global)...".
- `messages/{en,ko,ru}.json:247`: `footer.copyright` reads `© 2026 SH Core Stetics Global. All rights reserved.` (or KO/RU equivalents).
- `README.md` line 3 — internal doc only.
- `scripts/sync-from-jotform.ts`, `scripts/jotform-sync-report.txt` — internal scripts; jotform URLs contain `shcoresteticsglobal`. Out of scope.

### Performance surfaces
- `app/globals.css` line 49-56: `body` background uses radial gradients with `background-attachment: fixed`.
- `app/globals.css` lines 213-223: `.luxe-bg` / `.catalogue-luxe-bg` use `background-attachment: fixed` plus 60×60 grid pattern.
- `app/globals.css` line 60: `html { scroll-behavior: smooth }`.
- `app/globals.css` lines 91-96: `.glassmorphism` uses `backdrop-filter: blur(20px)` — applied to the fixed header at all times after scroll.
- `components/home/Hero.tsx` lines 24-56: 6 large framer-motion orbs animating `y` (or `y,x`) on infinite loop with `easeInOut` 6-12s cycles.
- `components/home/Hero.tsx` lines 58-59, 168-197: `<Sparkles />` renders 16 particles with infinite `opacity/scale/y` motion.
- `Hero.tsx` decorative motion divs use `pointer-events-none` — good — but the animations themselves run continuously regardless of scroll position.

### Mobile surfaces
- Hero: `min-h-screen flex items-center` + `py-32 pt-40` + title `text-5xl md:text-7xl` + stats row `flex gap-12 mt-16 pt-12`. On a 360 px viewport the title sits ~280 px below the fold and the 3 stats with `gap-12` are crowded.
- Header: logo `text-2xl tracking-widest "Lumée Maison"` is wide; right cluster has Search + (desktop-only Currency + Language) + Cart + Mobile menu.
- `CatalogueClient.tsx` line 451: `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5`. Phones (<640 px) get a single column.
- `CatalogueClient.tsx` line 345-419: top filter bar uses `flex flex-wrap` with filter button, search input (`min-w-48`), sort select, layout toggle, count text, clear button — wraps to multiple rows messily on narrow screens.
- `ProductCard.tsx` grid variant: `aspect-square` image, `p-6` info block, badges absolutely positioned top-left (up to 4 badges stacked), hover-only quick-add overlay (`translate-y-full group-hover:translate-y-0`). On mobile the overlay is unreachable.
- `Footer.tsx`: 4-column grid `lg:grid-cols-4`. Stacks to 1 column on mobile — long vertical scroll. Every section open by default.
- `app/[locale]/product/[id]/page.tsx` line 107: breadcrumb has 4 links + product name on one row, overflows on phones.
- `app/[locale]/product/[id]/page.tsx` line 182: inline ProductDetailClient (cart + WhatsApp) sits in the right column. On mobile after scrolling past it the CTA is offscreen during long description reading.
- `ProductDetailContent` and `ProductDetailTabs` render full description/protocol/ingredients with no progressive disclosure.
- Home `app/[locale]/page.tsx` lines 40, 62: Best Sellers / New Arrivals use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` — single column on mobile.
- `CategoryGrid.tsx` line 55: `grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5` — 3-column mobile, fine.
- All home sections use `py-24` / `py-28` — large vertical padding on phones.

## Design

Six units. They are independent enough to ship in parallel, but the plan should sequence them so user-visible changes land in this order: brand cleanup first (lowest risk), then global perf, then surface-by-surface mobile work.

### Unit 1 — Brand cleanup

**Files:** `lib/site-config.ts`, `components/home/Hero.tsx`, `components/layout/Footer.tsx`, `messages/en.json`, `messages/ko.json`, `messages/ru.json`, `README.md`.

- `lib/site-config.ts`:
  - `companyName: "Lumée Maison"`
  - Remove `companyNameAlt` field entirely (and any reference; only the footer reads it)
  - `payment.wise.accountName: "Lumée Maison"`
- `Hero.tsx` line 81: replace the inline string `"SH Core Stetics Global"` with the translation key `t('tagline')` (new key, see i18n below).
- `Footer.tsx` lines 21-24: remove the two `<p>` blocks that render `siteConfig.companyName` and `siteConfig.companyNameAlt`. Keep the `siteConfig.description` paragraph.
- Translation files — each of `en.json`, `ko.json`, `ru.json`:
  - `home.hero.tagline` — new key. EN: `"Premium Korean Aesthetics"`. KO: `"프리미엄 한국 에스테틱"`. RU: `"Премиальная корейская эстетика"`.
  - `about.story.content` — rewrite first sentence. EN: `"Lumée Maison is a specialized B2B supplier of premium Korean medical-grade aesthetic products."` Same neutral B2B framing in KO/RU; remove every mention of "SH Core Stetics Global" / "Skin Global".
  - `footer.copyright` — change to `© 2026 Lumée Maison. All rights reserved.` (KO/RU equivalents already use the same string verbatim — just replace the brand token).
- `README.md` line 3: replace `**SH Core Stetics Global (Skin Global)**` with `**Lumée Maison**`. Keep the rest.

Out of scope: jotform script URLs, jotform-sync-report.txt. Those reference the external Jotform submission endpoint and have to stay.

### Unit 2 — Global performance + animation reduction

**Files:** `app/globals.css`, `components/home/Hero.tsx`.

CSS changes (`app/globals.css`):
- Remove `background-attachment: fixed` from `body` (line 55), `.luxe-bg` (line 222), `.catalogue-luxe-bg` (line 222). The radial-gradient/grid patterns stay; they just scroll with content. This is the single biggest mobile-scroll win.
- Remove `html { scroll-behavior: smooth }` (line 60). Native scrolling.
- `.glassmorphism`: wrap `backdrop-filter`/`-webkit-backdrop-filter` in a media query so it only applies at `min-width: 768px`:
  ```css
  @media (min-width: 768px) {
    .glassmorphism {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
  }
  ```
  Below 768 px the header falls back to the solid `var(--glass-bg)` (already an `rgba` value, looks like a flat translucent panel — acceptable visually, much cheaper).
- Add a global `@media (prefers-reduced-motion: reduce)` rule that disables `animation` and `transition` durations to `0.01ms` for `.animate-pulse-slow`, `.skeleton`, and any `@keyframes float-*` consumers.

Hero changes (`components/home/Hero.tsx`):
- Replace the 6 motion orbs (lines 24-56) with 2 static `<div>`s that have a CSS radial gradient — no animation. Position: top-right and bottom-left. Class-based, not framer-motion.
- Reduce `<Sparkles />` particle count from 16 to 4. Increase per-particle duration so the cumulative animation load is roughly 1/8 of current.
- Wrap the remaining motion in a `prefers-reduced-motion` check (framer-motion's `useReducedMotion` hook): when reduce is requested, render the sparkles statically with their idle opacity.

### Unit 3 — Header + Hero (mobile-first)

**Files:** `components/layout/Header.tsx`, `components/home/Hero.tsx`.

Header:
- Logo: `text-2xl tracking-widest` → `text-xl tracking-wide md:text-2xl md:tracking-widest`.
- Mobile menu drawer (lines 181-220): the bottom row currently lays out language pills + currency button as `flex gap-3 flex-wrap`. Reorganise:
  - Three language pills on row 1 (full width row).
  - Currency button on row 2 as a labeled button (`"Currency: $ USD"`) — full-width, easier touch target.
  - New row 3: "Contact / Get a quote" link styled as `btn-secondary`, full-width, pointing to `/${locale}/contact`. Translation key `nav.contact` already exists.
- No change to desktop header.

Hero (`Hero.tsx`):
- `<section>`: `min-h-screen` → `min-h-[78vh] md:min-h-screen`.
- Container `py-32 pt-40` → `pt-28 pb-12 md:pt-40 md:py-32`.
- Tagline span: `text-xs` → `text-[10px] sm:text-xs`. (Content already changed in Unit 1.)
- Title `text-5xl md:text-7xl` → `text-4xl sm:text-5xl md:text-7xl`.
- Subtitle: drop `max-w-xl` on mobile (`max-w-none md:max-w-xl`).
- CTA wrapper: `flex flex-wrap gap-4` → `flex flex-col sm:flex-row gap-3 sm:gap-4`. Each CTA gets `w-full sm:w-auto`. Padding `px-8 py-4` → `px-6 py-3.5 sm:px-8 sm:py-4`.
- Stats row: `flex gap-12 mt-16 pt-12` → `grid grid-cols-3 gap-4 mt-10 pt-8 sm:flex sm:gap-12 sm:mt-16 sm:pt-12`. Stat number `text-3xl` → `text-2xl sm:text-3xl`.
- Scroll indicator (lines 150-163): add `hidden md:flex` to the container.

### Unit 4 — Catalogue + ProductCard (mobile-first)

**Files:** `components/catalogue/CatalogueClient.tsx`, `components/catalogue/ProductCard.tsx`.

ProductCard grid mode (`ProductCard.tsx` lines 116-180):
- Outer info block padding `p-6` → `p-3 md:p-6`.
- Quick-add overlay (lines 142-151): wrap in `hidden md:block`. Mobile users tap the card → product detail.
- Badges (lines 134-140): only render the first badge on mobile. Priority order `SALE > NEW > BEST > BUNDLE`. Use a small helper in the component:
  ```tsx
  const allBadges = [
    isBundle && <span key="b" className="badge-bundle">BUNDLE</span>,
    product.isSale && <span key="s" className="badge-sale">{tProduct('tags.sale')}</span>,
    product.isNew && <span key="n" className="badge-new">{tProduct('tags.new')}</span>,
    product.isBestSeller && <span key="x" className="badge-best">{tProduct('tags.bestSeller')}</span>,
  ].filter(Boolean);
  // mobile: show first (sale > new > best > bundle priority — reorder array)
  ```
  Reorder priority array so the mobile slice is `[sale, new, best, bundle]`. Desktop renders the full list.
- Name `text-base` → `text-sm md:text-base`.
- Specification line (line 165-167): add `hidden md:block`.
- Price `text-lg` → `text-base md:text-lg`.

ProductCard list mode (lines 57-113):
- Outer padding `p-4` → `p-3 sm:p-4`.
- Image `w-20 h-20` → `w-16 h-16 sm:w-20 sm:h-20`. Update `sizes="80px"` → `sizes="(max-width: 640px) 64px, 80px"`.

CatalogueClient (`CatalogueClient.tsx`):
- Grid (line 451): `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5` → `grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-5`.
- Top filter bar (lines 345-419): split into a logical 2-row layout on mobile.
  - Row 1 (always): filter button + search + sort. Wrap container `flex items-center gap-2 md:gap-3 md:flex-wrap`.
  - Row 2 (conditional, only when `hasActiveFilters`): active category chip + clear button. Currently a separate sub-block exists for the active category badge (lines 422-437) — extend it to host the clear button on mobile.
  - Layout toggle stays `hidden sm:flex` (unchanged).
  - Count text (`X cards / Y products`): on mobile move out of the top bar to a small line directly above the grid, `text-xs text-mist px-6 pt-3`. Desktop keeps it in the bar (`hidden md:inline ml-auto`).
- Sidebar stats grid (lines 320-337): add `hidden lg:grid` so the sidebar is shorter on mobile.
- Pagination (lines 487-525): compute visible-page count as `const visibleCount = isMobile ? 5 : 7;`. Easiest implementation: render `Math.min(5, totalPages)` always, but bump to 7 inside a `hidden md:contents` wrapper. Or simpler — compute `visibleCount` via a `useMediaQuery`-style approach. **Recommended:** render all 7 buttons but hide buttons at indices 0 and 6 below `md` (`first:hidden last:hidden md:first:inline md:last:inline`). Defer the exact technique to the plan.

### Unit 5 — Product detail page

**Files:** `app/[locale]/product/[id]/page.tsx`, `components/catalogue/ProductDetailClient.tsx`, `components/catalogue/ProductDetailContent.tsx`, `messages/{en,ko,ru}.json`.

Page-level:
- Container `py-12` → `py-6 md:py-12`. Grid `gap-12` → `gap-6 md:gap-12`.
- Breadcrumb (lines 107-121): wrap Home and Catalogue links in `hidden sm:inline` siblings (including their separator `/`). Product name span: `truncate max-w-[60vw] sm:max-w-xs`.
- Add a new mobile sticky CTA bar at the bottom of the page. Lives inside the same client tree — render it from `ProductDetailClient` so it has cart-store access.
  - Position: `fixed bottom-0 left-0 right-0 md:hidden`, `z-30`, white background with top border, padding `px-4 py-3`.
  - Contents: Add-to-Cart button (flex-1, primary style) + WhatsApp icon button (square, green).
  - Add `pb-20 md:pb-0` to the page container so the sticky bar doesn't cover the related-products section's bottom edge.

ProductDetailClient (`ProductDetailClient.tsx`):
- Hide the inline cart + WhatsApp row on mobile (`hidden md:flex` on the wrapper).
- Add a new section in the same component (or a sibling component) that renders the mobile sticky bar — see above.

ProductDetailContent (`components/catalogue/ProductDetailContent.tsx`):
- For description / indication / packaging / protocol blocks: on mobile, if text length > 240 chars or > 3 lines, render with `line-clamp-3` and a "더 보기 / Read more / Подробнее" toggle (translation key `product.readMore` / `product.readLess` — new keys in all three locales). Desktop renders the full text unconditionally.
- The toggle is a client-side `useState`. Track state per-block independently.

### Unit 6 — Footer + home below-fold

**Files:** `components/layout/Footer.tsx`, `app/[locale]/page.tsx`, `components/home/CategoryGrid.tsx`, `components/home/WhyChooseUs.tsx`, `components/home/CTASection.tsx`.

Footer (`Footer.tsx`):
- Outer padding `pt-16 pb-8` → `pt-10 pb-6 md:pt-16 md:pb-8`.
- Three "section" columns (Company nav, Payment & Shipping, Contact) become collapsible on mobile only:
  - Render each as a `<details>` element on mobile, plain `<div>` on desktop.
  - Approach: conditional class — `<details className="md:open md:[&>summary]:hidden md:[&_h3]:mb-5">`. Or simpler: render `<details>` always but force-open and hide the summary on `md:` via CSS:
    ```css
    @media (min-width: 768px) {
      details.footer-collapsible { open: true; }
      details.footer-collapsible > summary { list-style: none; pointer-events: none; }
    }
    ```
    Defer specific technique to plan. The user-visible behaviour: closed by default on mobile, open and non-interactive on desktop.
- Brand block (column 1) stays always-visible (not a `<details>`).
- Bottom row (copyright + disclaimer) unchanged.

Home page (`app/[locale]/page.tsx`):
- Best Sellers grid (line 40): `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6` → `grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6`.
- New Arrivals grid (line 62): same change.
- Section wrappers `py-24` → `py-12 md:py-24`.
- The two `<h2 className="section-title">` heads: leave as-is for now; CSS handles sizing.

CategoryGrid (`CategoryGrid.tsx`):
- Section `py-24` → `py-12 md:py-24`.
- Container `mb-16` → `mb-10 md:mb-16`.
- Icon circle `w-16 h-16 md:w-20 md:h-20` → `w-14 h-14 md:w-20 md:h-20`. Icon `size={24}` → keep `24` (looks fine in `w-14`).
- Stagger delay `i * 0.04` unchanged.

WhyChooseUs (`WhyChooseUs.tsx`):
- Section `py-24` → `py-12 md:py-24`.
- Card padding `p-8` → `p-5 md:p-8`.
- Heading mb `mb-16` → `mb-10 md:mb-16`.

CTASection (`CTASection.tsx`):
- Section `py-28` → `py-12 md:py-28`.
- CTA wrapper: `flex flex-wrap justify-center gap-4` → `flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-3 sm:gap-4`.
- Each CTA gets `w-full sm:w-auto justify-center`.

## i18n additions

New keys, all three locales (`en.json`, `ko.json`, `ru.json`):

- `home.hero.tagline` — see Unit 1.
- `product.readMore` — `"Read more"` / `"더 보기"` / `"Подробнее"`.
- `product.readLess` — `"Show less"` / `"접기"` / `"Свернуть"`.

Modified keys, all three locales:

- `about.story.content` — first sentence rewritten (Unit 1).
- `footer.copyright` — brand swap (Unit 1).

## Testing

Manual checklist, on real mobile viewport sizes (Chrome devtools 360 px, 390 px, 414 px) and a real device if possible:

1. **Brand:** grep `git grep -i "skinglobal\|korestetics\|sh core\|skin global"` — only matches in `scripts/` and `data/` (jotform script + report). No matches in any `.tsx`, `app/`, `components/`, `messages/*.json`, `lib/site-config.ts`, or `README.md`.
2. **Scroll perf:** open the home page on a mid-tier Android (Pixel 5 simulator or real device). Scroll Hero → Categories → Best Sellers → Why Choose Us → New Arrivals → CTA → Footer. No frame drops below 50 fps in Chrome devtools Performance recording. No layout shift on scroll.
3. **Hero mobile (360 px):** title visible above the fold or within one screen-height of the fold; CTAs full-width and stacked; stats render in a single horizontal row, no overflow.
4. **Catalogue mobile:** 2-column grid renders; filter bar fits on one or two rows without ugly wrapping; count line appears above grid; pagination shows ≤5 page buttons; sidebar opens in a slide-in panel on filter tap.
5. **ProductCard mobile:** max 1 badge visible; no hover-only quick-add visible; specification line hidden; name and price readable.
6. **Product detail mobile:** breadcrumb fits on one line; sticky bottom CTA bar visible while scrolling description; "Read more" toggle appears on long description; tapping it expands the block in place.
7. **Footer mobile:** Brand block always visible; the three other columns are collapsed `<details>`; tapping each expands its content.
8. **Footer desktop (≥768 px):** all four columns expanded by default; summary chevron not visible.
9. **Language switch:** EN/KO/RU all show the rewritten about content and new copyright. No literal `SH Core Stetics Global` or `Skin Global` strings appear in any locale.
10. **Reduced motion:** with `prefers-reduced-motion: reduce` enabled, Hero shows no continuous animation; the rest of the site has no motion either.

## Risks

- **Footer `<details>` cross-browser behaviour:** the desktop "force-open, no summary" technique varies; Safari has historically been finicky with `<details>` styling. Mitigation: render `<details open>` always and disable the summary via CSS at `md:`; if Safari breaks, fall back to JS-driven mobile-only accordion.
- **Glassmorphism removal on mobile:** the solid translucent header is visually less premium than the blurred one. Acceptable for the perf win; revisit only if user feedback complains.
- **`background-attachment: fixed` removal:** the gold radial corners and grid pattern will now scroll with content rather than stay anchored. Visually different on long pages. Acceptable; matches modern mobile-first practice.
- **Sticky bottom CTA bar on product detail:** can collide with iOS Safari's bottom bar / home indicator. Mitigation: add `safe-area-inset-bottom` padding (`pb-[env(safe-area-inset-bottom)]`).
- **2-column mobile catalogue grid:** at 320 px the cards become quite small. If the catalogue still looks cramped after implementation, revisit with `grid-cols-1 min-[400px]:grid-cols-2` (1 column on the smallest devices). Defer to QA.

## Out of scope (explicit)

- `app/[locale]/cart/page.tsx`, `app/[locale]/checkout/page.tsx`, `app/[locale]/payment/page.tsx` — no mobile rework in this spec.
- `app/manzura/*` — admin tool, not user-facing.
- `data/products.json` — no product copy or image changes.
- `scripts/*` and `*.txt` reports — internal tooling.
- A new "Lumée Maison" wordmark/logo asset. Continue using the current `font-display` text wordmark.
- SEO `<meta>` rewrites beyond what changes naturally via `messages/*.json` content.
