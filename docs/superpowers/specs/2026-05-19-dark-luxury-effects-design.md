# Dark Luxury + Smooth Effects — Design

Date: 2026-05-19
Owner: alanhon1

## Problem

The current cream + gold theme reads as flat: corners are sharp,
panels lack depth, and there is no ambient motion. The user wants the
storefront to feel "luxury" without abandoning the cream base —
specifically: black + gold accents layered on top, slow-floating gold
particles, smoother corners, slightly larger catalogue cards, and a
darker treatment for page headers (catalogue / categories / about).

## Source of truth

The existing theme tokens in `app/globals.css`. The dark accent palette
is the existing `--color-obsidian` / `--color-charcoal` / `--color-gold-dark`.

## Non-goals

- No full dark mode toggle.
- No Framer Motion or other heavy animation library.
- No new page templates — only adjust the existing layouts.
- No design changes to admin (`/manzura`).

## Design

### A. Theme + texture (`app/globals.css`)

- New CSS variables:
  - `--accent-glow: 0 0 24px rgba(201, 169, 110, 0.25);`
  - `--gold-shimmer: linear-gradient(120deg, transparent 30%, rgba(201,169,110,0.35) 50%, transparent 70%);`
  - `--obsidian-band: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%);`
  - `--glass-strong: rgba(255, 255, 255, 0.55);`
- Body gets a fixed radial gold-dust gradient overlay at the corners
  (`background-attachment: fixed`), opacity ~0.04.
- Glass panel utility (`.glass`) added: `backdrop-filter: blur(20px);
  background: var(--glass-strong); border: 1px solid var(--glass-border);`
- Buttons (`.btn-primary`, `.btn-secondary`, `.btn-gold`): radius
  `6px → 10px`. On hover, `.btn-gold` runs a 600ms shimmer sweep using
  `--gold-shimmer` translated `−100% → 200%`.
- `.product-card` radius `8px → 12px`. Hover: `translateY(-4px)` +
  `box-shadow: 0 12px 40px rgba(201, 169, 110, 0.18)`.
- `.badge-*` radius `4px → 6px`.

### B. Floating gold particles (`components/effects/GoldParticles.tsx`)

A single client component mounted once in `app/[locale]/layout.tsx`,
fixed full-screen below all interactive layers (`z-index: 1`,
`pointer-events: none`).

- 24 deterministic `<span>` nodes, each 1-3 px, gold (`#c9a96e`), opacity
  0.15-0.40.
- Six `@keyframes float-1..6` defined inline in the component
  (transforms `translate(...)` and `opacity` over 18-26 seconds), each
  particle assigned one keyframe by index modulo 6.
- Particles cluster in the left and right 20% of the viewport: x
  positions are biased to those bands.
- The component renders no children that affect layout; SSR-safe.

### C. Animations

- Page main content fades in 300ms on mount (`@keyframes page-enter`
  applied via `<main>` class).
- Catalogue cards: stagger fade-up 50ms × card index using
  `--enter-delay: calc(var(--i) * 50ms)` on each `ProductCard`. The
  `style` attribute carries the index.
- Sidebar category items: left-edge gold bar slide-in on hover
  (`::before` pseudo-element).
- Existing `.cart-panel`, `.overlay`, and `.glassmorphism` keep their
  current transitions.

### D. Catalogue size bump (`components/catalogue/ProductCard.tsx`)

- Name: `text-sm → text-base`.
- Spec line: `text-xs → text-sm`.
- Price: `text-base → text-lg`.
- Padding of info block: `p-5 → p-6`.
- Image area unchanged (`aspect-square`).

### E. Sidebar tuning (`components/catalogue/CatalogueClient.tsx`)

- Category buttons: `text-sm → text-base`, `py-2 → py-2.5`.
- Hover state: a 3px gold `::before` bar that slides in from `-12px`
  → `0` on hover.

### F. Dark page header band

A new component `components/layout/PageHeaderBand.tsx` (server-side):

```tsx
<div className="bg-obsidian-band text-cream py-12 px-6">
  <div className="max-w-7xl mx-auto">
    <h1 className="font-display text-4xl font-light">{title}</h1>
    {subtitle && <p className="text-sm text-bone/70 mt-2">{subtitle}</p>}
  </div>
</div>
```

Use it on the catalogue page (replaces the existing inline heading).
About and Contact already have prose-heavy hero sections — leave those
alone for now.

The `bg-obsidian-band` class is a one-off in `globals.css`:
`background: var(--obsidian-band);`.

## Verification

- Visit `/en` → gold particles drifting on left/right, hero unchanged
  in layout but card buttons softer.
- `/en/catalogue` → dark band at top with the title; sidebar items
  larger; cards slightly larger; hover shows gold glow + lift.
- Hover a `.btn-gold` → 600ms shimmer sweeps across.
- All pages → corners noticeably rounder.
- TypeScript `npx tsc --noEmit` zero errors.

## Rollback

Git revert: each commit is contained (theme tokens / particles /
component edits separated).

## Out of scope

- Full dark mode toggle.
- Per-page custom hero illustrations.
- Animated brand logo.
- Mobile-specific tweaks (current sizes scale OK on small screens).
