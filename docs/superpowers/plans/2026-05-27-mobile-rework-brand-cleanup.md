# Mobile-First Rework + Brand Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip all "SH Core Stetics Global / Skin Global" branding in favour of Lumée Maison, fix scroll performance, and rework header / hero / catalogue / product card / product detail / footer / home for mobile-first.

**Architecture:** Pure frontend rework — no API or data changes. Tailwind utility class swaps with `md:`/`lg:` modifiers preserve desktop. CSS in `globals.css` for global perf wins (kill `background-attachment: fixed`, gate `backdrop-filter` behind `md:`). Framer-motion reductions in Hero only. One new sticky mobile CTA bar on product detail; one new "Read more" toggle in long-text blocks; one mobile collapsible footer pattern.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, next-intl, framer-motion, lucide-react.

**Spec:** `docs/superpowers/specs/2026-05-27-mobile-rework-brand-cleanup-design.md`

**Verification model:** This project has no unit test suite. Each task verifies via (a) `npx tsc --noEmit`, (b) `npm run lint`, and (c) `npm run dev` + manual browser check at 360 px / 768 px / 1280 px. Commit after each task.

---

## Task 1: Brand cleanup

**Files:**
- Modify: `lib/site-config.ts`
- Modify: `components/home/Hero.tsx:79-83`
- Modify: `components/layout/Footer.tsx:21-24`
- Modify: `messages/en.json` (add `home.hero.tagline`; rewrite `about.story.content`; replace `footer.copyright`)
- Modify: `messages/ko.json` (same three changes)
- Modify: `messages/ru.json` (same three changes)
- Modify: `README.md:3`

- [ ] **Step 1.1: Update `lib/site-config.ts`**

Replace lines 2-5 (the four header fields). Remove `companyNameAlt`. Replace `payment.wise.accountName`.

```ts
export const siteConfig = {
  name: "Lumière",
  companyName: "Lumée Maison",
  tagline: "Premium Korean Aesthetic Cosmetics",
  description: "B2B wholesale supplier of premium Korean medical-grade aesthetic products. Serving professionals worldwide.",
```

In the `payment.wise` block:

```ts
    wise: {
      accountName: "Lumée Maison",
      accountDetails: "Please contact us for Wise payment details",
    },
```

- [ ] **Step 1.2: Update `components/home/Hero.tsx`**

Replace lines 79-83. Add an import for `useTranslations` argument at top (already imported on line 4 — `useTranslations`). Change the hard-coded brand tag to the new translation key.

```tsx
            <div className="h-px w-12 bg-gold" />
            <span className="text-xs font-semibold tracking-[0.3em] uppercase text-gold">
              {t('tagline')}
            </span>
```

- [ ] **Step 1.3: Update `components/layout/Footer.tsx`**

Replace lines 17-27 (the Brand column's top half). Keep the description paragraph and social row.

```tsx
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="font-display text-2xl font-light tracking-widest text-cream mb-3">
              Lumée Maison
            </div>
            <p className="text-xs text-cream/50 leading-relaxed">
              {siteConfig.description}
            </p>
```

(The social `<div className="flex gap-3 mt-6">` block underneath stays as-is.)

- [ ] **Step 1.4: Update `messages/en.json`**

In `home.hero` (around line 11-17), add `tagline` after `ctaSecondary`:

```json
    "hero": {
      "title": "Premium Korean",
      "titleAccent": "Aesthetic Cosmetics",
      "subtitle": "Professional-grade medical and aesthetic products sourced directly from Korea. Trusted by clinics and aesthetic professionals worldwide.",
      "cta": "View Catalogue",
      "ctaSecondary": "Contact Us",
      "tagline": "Premium Korean Aesthetics"
    },
```

In `about.story.content` (line 188), replace the value:

```json
      "content": "Lumée Maison is a specialized B2B supplier of premium Korean medical-grade aesthetic products. We connect aesthetic clinics, dermatologists, and beauty professionals worldwide with the finest products from Korea's leading manufacturers."
```

In `footer.copyright` (line 247), replace:

```json
    "copyright": "© 2026 Lumée Maison. All rights reserved.",
```

- [ ] **Step 1.5: Update `messages/ko.json`**

Add `tagline` in `home.hero` block:

```json
      "tagline": "프리미엄 한국 에스테틱"
```

Replace `about.story.content` (line 188):

```json
      "content": "Lumée Maison는 프리미엄 한국 의료 등급 에스테틱 제품의 전문 B2B 공급업체입니다. 전 세계 에스테틱 클리닉, 피부과 의사, 미용 전문가들을 한국 최고 제조업체의 최고 제품과 연결합니다."
```

Replace `footer.copyright` (line 247):

```json
    "copyright": "© 2026 Lumée Maison. All rights reserved.",
```

- [ ] **Step 1.6: Update `messages/ru.json`**

Add `tagline`:

```json
      "tagline": "Премиальная корейская эстетика"
```

Replace `about.story.content` (line 188):

```json
      "content": "Lumée Maison — специализированный B2B поставщик премиальных корейских медицинских эстетических продуктов. Мы соединяем эстетические клиники, дерматологов и специалистов по красоте по всему миру с лучшими продуктами от ведущих корейских производителей."
```

Replace `footer.copyright` (line 247):

```json
    "copyright": "© 2026 Lumée Maison. Все права защищены.",
```

- [ ] **Step 1.7: Update `README.md:3`**

Replace line 3:

```markdown
**Lumée Maison** — wholesale export platform for premium Korean medical-grade aesthetic products.
```

- [ ] **Step 1.8: Verify**

```bash
git grep -i "skinglobal\|korestetics\|sh core\|skin global"
```

Expected: matches only in `scripts/`, `data/`, `lumeemasonpic/node_modules/` (jotform URLs + dependency files). No matches in `app/`, `components/`, `lib/`, `messages/`, `README.md`.

```bash
npx tsc --noEmit && npm run lint
```

Expected: no errors.

- [ ] **Step 1.9: Commit**

```bash
git add lib/site-config.ts components/home/Hero.tsx components/layout/Footer.tsx messages/en.json messages/ko.json messages/ru.json README.md
git commit -m "feat(brand): remove SH Core Stetics Global / Skin Global from public surfaces"
```

---

## Task 2: Global CSS performance cleanup

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 2.1: Remove `background-attachment: fixed` from body**

In `app/globals.css` lines 49-56, drop the `background-attachment: fixed;` line:

```css
body {
  background-image:
    radial-gradient(at 0% 0%, rgba(201, 169, 110, 0.05) 0%, transparent 50%),
    radial-gradient(at 100% 0%, rgba(201, 169, 110, 0.04) 0%, transparent 50%),
    radial-gradient(at 0% 100%, rgba(201, 169, 110, 0.04) 0%, transparent 50%),
    radial-gradient(at 100% 100%, rgba(201, 169, 110, 0.05) 0%, transparent 50%);
}
```

- [ ] **Step 2.2: Remove `scroll-behavior: smooth`**

In `app/globals.css` line 60:

```css
  html { -webkit-text-size-adjust: 100%; }
```

- [ ] **Step 2.3: Gate `.glassmorphism` backdrop-blur behind `md:`**

Replace the `.glassmorphism` rule (lines 91-96):

```css
  /* Header glass — backdrop-blur only at md+ for mobile scroll perf */
  .glassmorphism {
    background: var(--glass-bg);
    border-bottom: 1px solid var(--glass-border);
  }
  @media (min-width: 768px) {
    .glassmorphism {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
  }
```

- [ ] **Step 2.4: Remove `background-attachment: fixed` from `.luxe-bg` / `.catalogue-luxe-bg`**

In lines 213-223, drop the `background-attachment: fixed;` line. Keep `overflow-x: hidden;`:

```css
  .luxe-bg,
  .catalogue-luxe-bg {
    position: relative;
    background-color: var(--page-bg);
    background-image:
      linear-gradient(rgba(201,169,110,0.18) 1px, transparent 1px),
      linear-gradient(90deg, rgba(201,169,110,0.18) 1px, transparent 1px);
    background-size: 60px 60px;
    overflow-x: hidden;
  }
```

- [ ] **Step 2.5: Add prefers-reduced-motion rule**

Append at the end of `app/globals.css` (after the last `@keyframes float-6` block, after the `@layer components` closes — append as a fresh top-level block):

```css
/* Reduced motion: disable infinite animations */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-slow,
  .skeleton,
  *[class*="animate-"] {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
  .cart-panel { transition: none !important; }
}
```

- [ ] **Step 2.6: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Then `npm run dev`, open `http://localhost:3000`, confirm the page renders (Hero, Categories, Best Sellers). On Chrome DevTools mobile emulation (360×800), scroll the home page top→bottom — should be markedly smoother than before.

- [ ] **Step 2.7: Commit**

```bash
git add app/globals.css
git commit -m "perf(css): drop fixed-attachment backgrounds, gate backdrop-blur to md+, honour reduced-motion"
```

---

## Task 3: Hero animation reduction

**Files:**
- Modify: `components/home/Hero.tsx`

- [ ] **Step 3.1: Replace the 6 motion orbs with 2 static gradients**

In `Hero.tsx` lines 24-56, remove all 6 `<motion.div>` orb blocks. Replace with two static decorative divs immediately after the existing gradient overlay block (lines 17-22):

```tsx
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-obsidian via-charcoal to-obsidian" />

      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
        <div className="w-full h-full bg-gradient-to-bl from-gold/30 to-transparent" />
      </div>

      {/* Static decorative glows (replaces 6 animated orbs) */}
      <div
        aria-hidden
        className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.10) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute bottom-1/4 left-1/5 w-80 h-80 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.08) 0%, transparent 70%)' }}
      />

      {/* Sparkle particles */}
      <Sparkles />
```

- [ ] **Step 3.2: Reduce `Sparkles` count from 16 to 4 and honour reduced-motion**

Replace the `Sparkles()` function (lines 168-197):

```tsx
function Sparkles() {
  const shouldReduceMotion = useReducedMotion();
  const particles = useMemo(() => Array.from({ length: 4 }, (_, i) => ({
    id: i,
    size: 3 + ((i * 1.5) % 5),
    top: `${15 + ((i * 23) % 70)}%`,
    left: `${10 + ((i * 31) % 80)}%`,
    delay: (i * 0.8) % 3,
    duration: 4 + ((i * 0.6) % 3),
  })), []);

  if (shouldReduceMotion) {
    return (
      <>
        {particles.map(p => (
          <div
            key={p.id}
            aria-hidden
            className="absolute rounded-full bg-gold/40 blur-sm pointer-events-none"
            style={{ width: p.size, height: p.size, top: p.top, left: p.left, opacity: 0.5 }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          aria-hidden
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

- [ ] **Step 3.3: Add `useReducedMotion` to the framer-motion import**

In `Hero.tsx` line 7, update the import:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
```

- [ ] **Step 3.4: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Then `npm run dev` and confirm Hero still renders with subtle background glow and 4 twinkling particles. Toggle Chrome DevTools "Emulate CSS prefers-reduced-motion: reduce" and reload — particles should now sit static.

- [ ] **Step 3.5: Commit**

```bash
git add components/home/Hero.tsx
git commit -m "perf(hero): replace 6 animated orbs with static gradients, cut sparkles 16→4, honour reduced-motion"
```

---

## Task 4: Header mobile rework

**Files:**
- Modify: `components/layout/Header.tsx`

- [ ] **Step 4.1: Slim the logo on mobile**

In `Header.tsx` lines 75-81, change the Logo `<Link>` className:

```tsx
          <Link
            href={`/${locale}`}
            className="font-display text-xl tracking-wide md:text-2xl md:tracking-widest font-light hover:text-gold transition-colors duration-300"
            style={{ color: 'var(--page-text)' }}
          >
            Lumée Maison
          </Link>
```

- [ ] **Step 4.2: Reorganise mobile menu bottom rows**

In `Header.tsx` lines 196-218 (the mobile menu's bottom `<div className="flex gap-3 pt-3 border-t flex-wrap">` block), replace with three rows:

```tsx
            <div className="pt-3 border-t flex flex-col gap-3" style={{ borderColor: 'var(--border-color)' }}>
              {/* Language pills row */}
              <div className="flex gap-2">
                {locales.map(l => (
                  <Link
                    key={l}
                    href={getLocalePath(l)}
                    className="flex-1 text-center text-xs font-bold tracking-wider px-3 py-2 border rounded-md transition-colors"
                    style={{
                      borderColor: l === locale ? 'var(--accent)' : 'var(--border-color)',
                      color: l === locale ? 'var(--accent)' : 'var(--page-text-2)',
                    }}
                  >
                    {LOCALE_LABELS[l]}
                  </Link>
                ))}
              </div>

              {/* Currency row (full-width labeled button) */}
              <button
                onClick={cycleCurrency}
                className="w-full text-left text-xs font-semibold tracking-wider px-3 py-2 border rounded-md transition-colors flex items-center justify-between"
                style={{ borderColor: 'var(--border-color)', color: 'var(--page-text)' }}
              >
                <span style={{ color: 'var(--page-text-2)' }}>Currency</span>
                <span>{CURRENCY_LABEL[displayCurrency]}</span>
              </button>

              {/* Contact CTA */}
              <Link
                href={`/${locale}/contact`}
                className="w-full text-center text-xs font-semibold tracking-widest uppercase px-3 py-2.5 border rounded-md transition-colors"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                {t('contact')}
              </Link>
            </div>
```

- [ ] **Step 4.3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

`npm run dev`, open at 360 px viewport, tap the hamburger. Expected: 4 nav links stacked, then a horizontal row of EN/RU/KO pills, then a labeled "Currency / $ USD" button, then a gold-bordered "CONTACT" CTA.

- [ ] **Step 4.4: Commit**

```bash
git add components/layout/Header.tsx
git commit -m "feat(header): slim logo on mobile, reorganise mobile menu with labeled currency and contact CTA"
```

---

## Task 5: Hero mobile layout

**Files:**
- Modify: `components/home/Hero.tsx`

- [ ] **Step 5.1: Section min-height and padding**

Replace line 15 (`<section>`):

```tsx
    <section className="relative min-h-[78vh] md:min-h-screen flex items-center overflow-hidden bg-obsidian">
```

Replace line 70 (`<div className="relative max-w-7xl ...">`):

```tsx
      <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-12 md:pt-40 md:py-32">
```

- [ ] **Step 5.2: Tagline span size**

Replace line 80 (the `<span>` with `text-xs`):

```tsx
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.3em] uppercase text-gold">
              {t('tagline')}
            </span>
```

- [ ] **Step 5.3: Title size**

Replace line 90 (the `<motion.h1>` className):

```tsx
            className="font-display text-4xl sm:text-5xl md:text-7xl font-light leading-[1.1] text-cream mb-6"
```

- [ ] **Step 5.4: Subtitle width**

Replace line 102 (the subtitle `<motion.p>` className):

```tsx
            className="text-cream/60 text-base md:text-lg leading-relaxed max-w-none md:max-w-xl mb-10"
```

- [ ] **Step 5.5: CTA wrapper + buttons**

Replace lines 108-127. The wrapper becomes column on mobile; each `<Link>` gets `w-full sm:w-auto` and slimmer mobile padding:

```tsx
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <Link
              href={`/${locale}/catalogue`}
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-gold text-cream text-xs font-semibold tracking-[0.2em] uppercase hover:bg-gold-dark transition-all duration-300 group"
            >
              {t('cta')}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 border border-cream/30 text-cream text-xs font-semibold tracking-[0.2em] uppercase hover:border-gold hover:text-gold transition-all duration-300"
            >
              {t('ctaSecondary')}
            </Link>
          </motion.div>
```

- [ ] **Step 5.6: Stats row**

Replace lines 130-146:

```tsx
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="grid grid-cols-3 gap-4 mt-10 pt-8 sm:flex sm:gap-12 sm:mt-16 sm:pt-12 border-t border-cream/10"
          >
            {[
              { value: '420', label: 'Products' },
              { value: '20', label: 'Categories' },
              { value: '50+', label: 'Countries Served' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="font-display text-2xl sm:text-3xl font-light text-cream">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-cream/50 tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
```

- [ ] **Step 5.7: Hide scroll indicator on mobile**

Replace lines 151-163 (the scroll indicator `<motion.div>` outer container className):

```tsx
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2"
      >
```

- [ ] **Step 5.8: Verify**

```bash
npx tsc --noEmit && npm run lint
```

At 360 px viewport: Hero title visible within first screen, CTAs stacked full-width, stats in 3-column grid with no overflow, no scroll chevron. At 1280 px: layout matches the original (CTAs side-by-side, stats horizontal with gap-12, scroll chevron visible).

- [ ] **Step 5.9: Commit**

```bash
git add components/home/Hero.tsx
git commit -m "feat(hero): mobile-first layout — shorter section, stacked CTAs, 3-col stats grid"
```

---

## Task 6: ProductCard mobile rework

**Files:**
- Modify: `components/catalogue/ProductCard.tsx`

- [ ] **Step 6.1: Reduce list-mode image and padding**

Replace lines 57-72 (the list mode `<Link>` opening and image div):

```tsx
  if (layout === 'list') {
    return (
      <Link
        href={`/${locale}/product/${product.id}`}
        onClick={rememberCatalogueUrl}
        className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white border border-bone rounded-md hover:border-gold transition-all duration-300 group"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 relative overflow-hidden">
          <ProductImage
            src={displayImage}
            alt={displayName}
            productId={product.id}
            categoryId={product.categoryId}
            fill
            sizes="(max-width: 640px) 64px, 80px"
          />
        </div>
```

- [ ] **Step 6.2: Add a mobile-priority badge helper and update grid-mode badge area**

Replace lines 134-140 (grid-mode badges block) with a priority-ordered render that shows only the first on mobile:

```tsx
        {/* Badges — mobile: first only (priority sale > new > best > bundle); desktop: all */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {(() => {
            const all = [
              product.isSale && <span key="s" className="badge-sale">{tProduct('tags.sale')}</span>,
              product.isNew && <span key="n" className="badge-new">{tProduct('tags.new')}</span>,
              product.isBestSeller && <span key="b" className="badge-best">{tProduct('tags.bestSeller')}</span>,
              isBundle && <span key="bd" className="badge-bundle">BUNDLE</span>,
            ].filter(Boolean) as React.ReactElement[];
            if (all.length === 0) return null;
            return (
              <>
                <div className="md:hidden">{all[0]}</div>
                <div className="hidden md:flex md:flex-col md:gap-1">{all}</div>
              </>
            );
          })()}
        </div>
```

- [ ] **Step 6.3: Hide quick-add overlay on mobile**

Replace lines 142-151 (the quick-add overlay wrapper):

```tsx
        {/* Quick Add overlay — desktop only (hover-based) */}
        <div className="hidden md:block absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button
            onClick={handleAddToCart}
            className="w-full btn-gold text-[10px] py-2.5 flex items-center justify-center gap-2"
          >
            <ShoppingBag size={13} />
            {t('addToCart')}
          </button>
        </div>
```

- [ ] **Step 6.4: Compact grid-mode info block (padding + text sizes + hide spec on mobile)**

Replace lines 154-178 (`{/* Info */}` block through the end of the card, just before the closing `</Link>`):

```tsx
      {/* Info */}
      <div className="p-3 md:p-6">
        <p className="text-xs text-mist mb-1">{displayId}</p>
        <h3 className="text-sm md:text-base font-semibold text-charcoal group-hover:text-gold transition-colors leading-tight line-clamp-2 mb-2">
          {displayName}
        </h3>
        {variantCount > 1 && (
          <p className="text-[10px] text-gold/80 font-medium tracking-wide mb-1">
            {variantCount} options available
          </p>
        )}
        {product.specification && (
          <p className="hidden md:block text-sm text-mist line-clamp-1 mb-3">{getLocalizedSpecification(product, locale)}</p>
        )}
        <div className="flex items-center justify-between">
          <div>
            <span className="font-display text-base md:text-lg font-light text-charcoal">
              {formatPrice(product.price, currency)}
            </span>
            {product.moq > 1 && (
              <span className="text-xs text-mist ml-1.5">MOQ:{product.moq}</span>
            )}
          </div>
        </div>
      </div>
```

- [ ] **Step 6.5: Verify**

```bash
npx tsc --noEmit && npm run lint
```

`npm run dev`, open `/en/catalogue` at 360 px. A grid card should be compact: small padding, single badge max, hidden spec line, no quick-add overlay visible. At 1280 px, the card should look essentially unchanged from before: full badges stack, spec line visible, hover overlay works.

- [ ] **Step 6.6: Commit**

```bash
git add components/catalogue/ProductCard.tsx
git commit -m "feat(card): mobile-first product card — compact padding, single badge, no hover overlay"
```

---

## Task 7: CatalogueClient mobile rework

**Files:**
- Modify: `components/catalogue/CatalogueClient.tsx`

- [ ] **Step 7.1: Mobile-first product grid (2 cols)**

Replace line 451:

```tsx
            <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 md:gap-5">
```

- [ ] **Step 7.2: Hide sidebar stats grid on mobile**

Replace line 320 (the stats grid wrapper):

```tsx
          <div className="mt-10 pt-6 border-t border-bone hidden lg:grid grid-cols-2 gap-3 text-center">
```

- [ ] **Step 7.3: Move count line out of top bar on mobile**

Replace lines 405-407 (the `Count` span):

```tsx
            {/* Count — desktop only in top bar */}
            <span className="hidden md:inline text-sm text-mist ml-auto">
              {renders.length} {t('cards')} / {totalProductsRepresented} {t('productsLong')}
            </span>
```

Then immediately above the `{/* Products */}` `<div className="p-6">` block (line 441), insert a mobile-only count line:

```tsx
        {/* Mobile count line */}
        <div className="md:hidden px-6 pt-3 text-xs text-mist">
          {renders.length} {t('cards')} / {totalProductsRepresented} {t('productsLong')}
        </div>

        {/* Products */}
        <div className="p-6 pt-4 md:pt-6">
```

- [ ] **Step 7.4: Cap pagination buttons to 5 on mobile, 7 on desktop**

Replace lines 496-516 (the page-button `Array.from` block) with a version that hides the outermost buttons below `md`:

```tsx
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 7) {
                  if (page <= 4) pageNum = i + 1;
                  else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                  else pageNum = page - 3 + i;
                }
                // On mobile, hide the first and last of the 7 buttons (visible window = 5)
                const hideOnMobile = i === 0 || i === 6;
                return (
                  <button
                    key={pageNum}
                    onClick={() => { setPage(pageNum); updateUrl({ page: pageNum }); window.scrollTo(0, 0); }}
                    className={`${hideOnMobile ? 'hidden md:inline-flex' : 'inline-flex'} items-center justify-center w-8 h-8 text-xs border rounded-md transition-colors ${
                      page === pageNum
                        ? 'bg-obsidian text-cream border-obsidian'
                        : 'border-bone hover:border-gold hover:text-gold'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
```

- [ ] **Step 7.5: Verify**

```bash
npx tsc --noEmit && npm run lint
```

`/en/catalogue` at 360 px: grid is 2 columns with small gap; count text appears above grid (not in top bar); pagination shows max 5 page buttons. At 1280 px: 3-column grid (or 4 at 2xl), count in top bar right side, 7 page buttons visible.

- [ ] **Step 7.6: Commit**

```bash
git add components/catalogue/CatalogueClient.tsx
git commit -m "feat(catalogue): mobile-first grid (2 col), count above grid, slim sidebar, capped pagination"
```

---

## Task 8: Product detail page mobile + sticky CTA bar

**Files:**
- Modify: `app/[locale]/product/[id]/page.tsx`
- Modify: `components/catalogue/ProductDetailClient.tsx`

- [ ] **Step 8.1: Compact page paddings and grid gap**

In `app/[locale]/product/[id]/page.tsx`, replace lines 102-103 (the outer wrappers):

```tsx
    <div className="pt-24 min-h-screen bg-cream pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-6 py-6 md:py-12">
```

Replace line 123 (the gallery+info grid):

```tsx
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12 items-start">
```

- [ ] **Step 8.2: Truncate breadcrumb on mobile**

Replace lines 107-121 (the entire breadcrumb `<nav>`):

```tsx
        <nav className="flex items-center gap-2 text-xs text-mist mb-8">
          <Link href={`/${locale}`} className="hidden sm:inline hover:text-gold transition-colors">Home</Link>
          <span className="hidden sm:inline">/</span>
          <Link href={`/${locale}/catalogue`} className="hidden sm:inline hover:text-gold transition-colors">Catalogue</Link>
          {category && (
            <>
              <span className="hidden sm:inline">/</span>
              <Link href={`/${locale}/catalogue/${category.id}`} className="hover:text-gold transition-colors">
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-charcoal font-medium truncate max-w-[60vw] sm:max-w-xs">{product.name}</span>
        </nav>
```

- [ ] **Step 8.3: Update `ProductDetailClient.tsx` — hide inline CTAs on mobile, add sticky bar**

Replace the entire `ProductDetailClient.tsx` file:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShoppingBag, MessageCircle, Check } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';
import { siteConfig } from '@/lib/site-config';
import type { Product } from '@/lib/products';

export default function ProductDetailClient({ product }: { product: Product }) {
  const t = useTranslations('product');
  const tCat = useTranslations('catalogue');
  const { addItem } = useCartStore();
  useCurrencyStore();
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      specification: product.specification,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const whatsappHref = `${siteConfig.social.whatsapp}?text=${encodeURIComponent(`Hi! I'm interested in: #${product.id} ${product.name}`)}`;

  return (
    <>
      {/* Inline CTAs — desktop only */}
      <div className="hidden md:flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleAddToCart}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-semibold tracking-[0.2em] uppercase transition-all duration-300 ${
            added
              ? 'bg-green-600 text-white border border-green-600'
              : 'btn-primary'
          }`}
        >
          {added ? (
            <>
              <Check size={16} />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingBag size={16} />
              {tCat('addToCart')}
            </>
          )}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-6 py-4 bg-[#25D366] text-white text-xs font-semibold tracking-[0.2em] uppercase hover:bg-[#20bd5a] transition-colors"
        >
          <MessageCircle size={16} />
          {t('contactForOrder')}
        </a>
      </div>

      {/* Mobile sticky bottom CTA bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-bone px-4 py-3 flex items-center gap-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleAddToCart}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-[0.15em] uppercase transition-all ${
            added
              ? 'bg-green-600 text-white'
              : 'btn-primary'
          }`}
        >
          {added ? (
            <>
              <Check size={14} />
              Added
            </>
          ) : (
            <>
              <ShoppingBag size={14} />
              {tCat('addToCart')}
            </>
          )}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('contactForOrder')}
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors"
        >
          <MessageCircle size={18} />
        </a>
      </div>
    </>
  );
}
```

- [ ] **Step 8.4: Verify**

```bash
npx tsc --noEmit && npm run lint
```

`npm run dev`, navigate to any product detail page (e.g. `/en/product/1`). At 360 px: breadcrumb shows only `Category / Product` (truncated); the inline cart+WhatsApp row is hidden; a fixed bottom bar with Add-to-Cart + WhatsApp is visible while scrolling; bar respects iOS safe-area inset. At 1280 px: inline row visible in the right column; no sticky bar.

- [ ] **Step 8.5: Commit**

```bash
git add app/[locale]/product/[id]/page.tsx components/catalogue/ProductDetailClient.tsx
git commit -m "feat(product): truncated breadcrumb, mobile sticky bottom CTA bar with safe-area inset"
```

---

## Task 9: Product detail Read-more toggle for long blocks

**Files:**
- Modify: `components/catalogue/ProductDetailContent.tsx`
- Modify: `messages/en.json`, `messages/ko.json`, `messages/ru.json` (add `product.readMore` and `product.readLess`)

- [ ] **Step 9.1: Add new i18n keys**

In `messages/en.json`, in the `product` block (near line 116), add:

```json
    "readMore": "Read more",
    "readLess": "Show less",
```

In `messages/ko.json`, in the `product` block:

```json
    "readMore": "더 보기",
    "readLess": "접기",
```

In `messages/ru.json`, in the `product` block:

```json
    "readMore": "Подробнее",
    "readLess": "Свернуть",
```

- [ ] **Step 9.2: Convert `ProductDetailContent.tsx` to client component with collapsible blocks**

Replace the entire file `components/catalogue/ProductDetailContent.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Product } from '@/lib/products';
import {
  getLocalizedDescription,
  getLocalizedIndication,
  getLocalizedPackaging,
  getLocalizedProtocol,
} from '@/lib/products';

interface Props {
  product: Product;
  locale: string;
  labels: {
    description: string;
    indication: string;
    packaging: string;
    protocol: string;
  };
}

function CollapsibleBlock({ label, body, threshold = 240 }: { label: string; body: string; threshold?: number }) {
  const t = useTranslations('product');
  const [expanded, setExpanded] = useState(false);
  const text = body || '—';
  const isLong = text.length > threshold;

  return (
    <div>
      <h3 className="text-xs font-semibold tracking-wider uppercase text-mist mb-2">
        {label}
      </h3>
      <p
        className={`text-sm text-charcoal leading-relaxed whitespace-pre-line ${
          isLong && !expanded ? 'line-clamp-3 md:line-clamp-none' : ''
        }`}
      >
        {text}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="md:hidden mt-2 text-xs font-semibold tracking-wider uppercase text-gold hover:text-gold-dark transition-colors"
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      )}
    </div>
  );
}

export default function ProductDetailContent({ product, locale, labels }: Props) {
  const description = getLocalizedDescription(product, locale);
  const indication = getLocalizedIndication(product, locale);
  const packaging = getLocalizedPackaging(product, locale);
  const protocol = getLocalizedProtocol(product, locale);

  return (
    <section className="mt-10 bg-white border border-bone rounded-sm p-5 md:p-8">
      <CollapsibleBlock label={labels.description} body={description} threshold={320} />

      <div className="gold-divider my-6" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CollapsibleBlock label={labels.indication} body={indication} />
        <CollapsibleBlock label={labels.packaging} body={packaging} />
        <CollapsibleBlock label={labels.protocol} body={protocol} />
      </div>
    </section>
  );
}
```

- [ ] **Step 9.3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

Navigate to a product with a long description (any filler product, e.g. `/en/product/5`). At 360 px: long blocks show `line-clamp-3` with a "Read more" gold link below; tap → expands inline → label becomes "Show less". At 1280 px: all text shown unconditionally, no Read more link.

Switch locale to KO and RU and confirm the link text is localised.

- [ ] **Step 9.4: Commit**

```bash
git add components/catalogue/ProductDetailContent.tsx messages/en.json messages/ko.json messages/ru.json
git commit -m "feat(product): mobile Read more/Show less toggle on long description/indication/packaging/protocol"
```

---

## Task 10: Footer mobile collapsible

**Files:**
- Modify: `components/layout/Footer.tsx`
- Modify: `app/globals.css`

- [ ] **Step 10.1: Add a CSS rule to force-open and hide-summary on desktop**

Append at the very end of `app/globals.css`, after the reduced-motion block from Task 2:

```css
/* Footer collapsible — desktop hides the summary (Footer.tsx forces open via `open` attr) */
details.footer-collapsible > summary { list-style: none; }
details.footer-collapsible > summary::-webkit-details-marker { display: none; }
@media (min-width: 768px) {
  details.footer-collapsible > summary {
    cursor: default;
    pointer-events: none;
  }
}
```

- [ ] **Step 10.2: Make footer a client component with mobile-collapsible columns**

Replace `components/layout/Footer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { siteConfig } from '@/lib/site-config';
import { Share2, Link2, MessageCircle, Send, ChevronDown } from 'lucide-react';

export default function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const navLinks = [
    { href: `/${locale}`, label: tNav('home') },
    { href: `/${locale}/catalogue`, label: tNav('catalogue') },
    { href: `/${locale}/about`, label: tNav('about') },
    { href: `/${locale}/contact`, label: tNav('contact') },
  ];

  function SectionHeader({ title }: { title: string }) {
    return (
      <summary className="flex items-center justify-between text-xs font-semibold tracking-widest uppercase text-cream mb-3 md:mb-5 cursor-pointer md:cursor-default list-none">
        <span>{title}</span>
        <ChevronDown size={14} className="md:hidden transition-transform group-open:rotate-180" />
      </summary>
    );
  }

  return (
    <footer className="bg-charcoal text-cream/80 mt-auto">
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6 md:pt-16 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
          {/* Brand — always visible */}
          <div className="lg:col-span-1">
            <div className="font-display text-2xl font-light tracking-widest text-cream mb-3">
              Lumée Maison
            </div>
            <p className="text-xs text-cream/50 leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="flex gap-3 mt-6">
              <a href={siteConfig.social.instagram} target="_blank" rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors" aria-label="Instagram">
                <Share2 size={15} />
              </a>
              <a href={siteConfig.social.facebook} target="_blank" rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors" aria-label="Facebook">
                <Link2 size={15} />
              </a>
              <a href={siteConfig.social.whatsapp} target="_blank" rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors" aria-label="WhatsApp">
                <MessageCircle size={15} />
              </a>
              <a href={siteConfig.social.telegram} target="_blank" rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors" aria-label="Telegram">
                <Send size={15} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <details open={isDesktop} className="footer-collapsible group">
            <SectionHeader title={t('company')} />
            <ul className="space-y-3 pt-2 md:pt-0">
              {navLinks.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-xs text-cream/60 hover:text-gold transition-colors tracking-wide">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          {/* Payment & Shipping */}
          <details open={isDesktop} className="footer-collapsible group">
            <SectionHeader title={t('payment')} />
            <ul className="space-y-3 pt-2 md:pt-0">
              <li className="text-xs text-cream/60"><span className="text-gold">Wise</span> — Bank Transfer</li>
              <li className="text-xs text-cream/60"><span className="text-gold">USDT</span> — TRC-20 Network</li>
            </ul>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-cream mb-3 md:mb-5 mt-6 md:mt-8">
              {t('shipping')}
            </h3>
            <ul className="space-y-2">
              <li className="text-xs text-cream/60">
                FedEx with account: <span className="text-gold">${siteConfig.shipping.fedexWithAccount}</span>
              </li>
              <li className="text-xs text-cream/60">
                FedEx without account: <span className="text-gold">${siteConfig.shipping.fedexWithoutAccount}</span>
              </li>
              <li className="text-xs text-cream/50 mt-1">
                {siteConfig.shipping.fedexNote}
              </li>
            </ul>
          </details>

          {/* Contact */}
          <details open={isDesktop} className="footer-collapsible group">
            <SectionHeader title="Contact" />
            <ul className="space-y-3 pt-2 md:pt-0">
              <li>
                <a href={`mailto:${siteConfig.contact.email}`} className="text-xs text-cream/60 hover:text-gold transition-colors">
                  {siteConfig.contact.email}
                </a>
              </li>
              <li>
                <a href={siteConfig.social.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-cream/60 hover:text-gold transition-colors">
                  WhatsApp: {siteConfig.contact.whatsapp}
                </a>
              </li>
              <li>
                <a href={siteConfig.social.telegram} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-cream/60 hover:text-gold transition-colors">
                  Telegram: {siteConfig.contact.telegram}
                </a>
              </li>
              <li className="text-xs text-cream/50">{siteConfig.contact.address}</li>
            </ul>
          </details>
        </div>

        {/* Bottom */}
        <div className="border-t border-cream/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/40">{t('copyright')}</p>
          <p className="text-xs text-cream/40 text-center">{t('disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 10.3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

At 360 px viewport: Brand column shows expanded; Company / Payment / Contact each render as a collapsed `<details>` with a chevron — tap toggles them open. At 1280 px: all four columns are visible, no chevrons, headers can't be clicked (cursor stays default).

Refresh-resize test: open page at desktop width (all expanded), narrow to mobile width — sections should remain expanded once opened. Reload at mobile width — should be collapsed by default.

- [ ] **Step 10.4: Commit**

```bash
git add components/layout/Footer.tsx app/globals.css
git commit -m "feat(footer): collapsible columns on mobile, always-open on desktop"
```

---

## Task 11: Home below-fold mobile (CategoryGrid, WhyChooseUs, CTASection, page grids)

**Files:**
- Modify: `app/[locale]/page.tsx`
- Modify: `components/home/CategoryGrid.tsx`
- Modify: `components/home/WhyChooseUs.tsx`
- Modify: `components/home/CTASection.tsx`

- [ ] **Step 11.1: Tighten home page section paddings and product grids**

In `app/[locale]/page.tsx`, update both Best Sellers and New Arrivals sections.

Replace line 31 (Best Sellers `<section>`):

```tsx
        <section className="py-12 md:py-24 bg-transparent">
```

Replace line 40 (Best Sellers grid):

```tsx
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
```

Replace line 53 (New Arrivals `<section>`):

```tsx
        <section className="py-12 md:py-24">
```

Replace line 62 (New Arrivals grid):

```tsx
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
```

Also tighten the inner header padding. Replace line 33 and 55 (`<div className="mb-12">`):

```tsx
            <div className="mb-8 md:mb-12">
```

(Both Best Sellers and New Arrivals.)

- [ ] **Step 11.2: Tighten CategoryGrid**

In `components/home/CategoryGrid.tsx`, replace line 39 (`<section>`):

```tsx
    <section className="py-12 md:py-24">
```

Replace line 46 (`<motion.div ... mb-16>`):

```tsx
          className="text-center mb-10 md:mb-16"
```

Replace line 70 (the icon circle `<div>` className):

```tsx
                  <div className="relative w-14 h-14 md:w-20 md:h-20 rounded-full border border-gold/30 bg-cream flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:border-gold group-hover:shadow-[0_0_20px_rgba(201,169,110,0.35)]">
```

- [ ] **Step 11.3: Tighten WhyChooseUs**

In `components/home/WhyChooseUs.tsx`, replace line 14 (`<section>`):

```tsx
    <section className="py-12 md:py-24 bg-obsidian text-cream overflow-hidden">
```

Replace line 21 (header `<motion.div ... mb-16>`):

```tsx
          className="text-center mb-10 md:mb-16"
```

Replace line 42 (the card `<motion.div ... p-8>` className):

```tsx
                className="group text-center p-5 md:p-8 border border-cream/10 hover:border-gold/40 transition-all duration-500 hover:bg-cream/5"
```

- [ ] **Step 11.4: Tighten CTASection**

In `components/home/CTASection.tsx`, replace line 15 (`<section>`):

```tsx
    <section className="py-12 md:py-28 bg-transparent overflow-hidden relative">
```

Replace line 30 (the CTAs wrapper):

```tsx
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-3 sm:gap-4">
```

Replace lines 31-55 (the three CTA anchor/link blocks) — each one gets `w-full sm:w-auto justify-center`:

```tsx
            <a
              href={siteConfig.social.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[#25D366] text-white text-xs font-semibold tracking-wider uppercase hover:bg-[#20bd5a] transition-colors"
            >
              <MessageCircle size={16} />
              {t('whatsapp')}
            </a>
            <a
              href={siteConfig.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-[#2AABEE] text-white text-xs font-semibold tracking-wider uppercase hover:bg-[#1c9ad6] transition-colors"
            >
              <Send size={16} />
              {t('telegram')}
            </a>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto btn-primary text-xs px-6 py-3"
            >
              <Mail size={16} />
              {t('email')}
            </Link>
```

- [ ] **Step 11.5: Verify**

```bash
npx tsc --noEmit && npm run lint
```

At 360 px home page: section vertical padding visibly tighter; Best Sellers and New Arrivals each render in 2 columns; Categories show smaller icons in a 3-col grid; CTAs at the bottom are stacked full-width. At 1280 px: largely identical to before.

- [ ] **Step 11.6: Commit**

```bash
git add app/[locale]/page.tsx components/home/CategoryGrid.tsx components/home/WhyChooseUs.tsx components/home/CTASection.tsx
git commit -m "feat(home): tighter mobile section paddings, 2-col mobile product grids, stacked mobile CTAs"
```

---

## Task 12: Final verification

- [ ] **Step 12.1: Run the full grep audit**

```bash
git grep -i "skinglobal\|korestetics\|sh core\|skin global"
```

Expected matches only in: `scripts/sync-from-jotform.ts` (jotform URL), `scripts/jotform-sync-report.txt` (jotform URLs), `lumeemasonpic/node_modules/` (dependency files). No matches in `app/`, `components/`, `lib/`, `messages/`, `README.md`, `docs/`.

- [ ] **Step 12.2: Run typecheck + lint + build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all green.

- [ ] **Step 12.3: Manual smoke test at three viewports**

Run `npm run dev`. Open Chrome DevTools and emulate at 360×800, 768×1024, 1280×800. For each viewport visit:

- `/en` — home: Hero, Categories, Best Sellers, Why Choose Us, New Arrivals, CTA, Footer.
- `/en/catalogue` — catalogue: grid + filter sidebar + pagination.
- `/en/product/5` — product detail: gallery + info + description + sticky bar (mobile only).
- `/ko/about` and `/ru/about` — confirm rewritten about content shows.

At 360 px specifically: scroll the home page top to bottom; observe scroll smoothness (target: no visible jank, 50+ fps in DevTools Performance).

- [ ] **Step 12.4: Reduced-motion check**

In Chrome DevTools → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`. Reload `/en`. Hero sparkles should not animate.

- [ ] **Step 12.5: Final summary commit (no code, just confirms completion)**

No commit needed if everything passed in earlier commits. If any small fix was needed during smoke test, commit it separately as `fix(qa): ...`.
