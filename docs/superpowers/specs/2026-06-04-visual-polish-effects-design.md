# Visual polish & micro-interactions — Lumée Maison

## Context

`CLAUDE_design.md` (root of the repo) is the prescriptive spec the user
wrote: 10 micro-interaction targets on the customer surface (buttons,
gold-glow utility, product cards, header glass, category icons,
sidebar cat-bar, hero scroll cue + gold dust, page enter, badges,
home logo shimmer) plus a footnote: extend the relevant effects to
`/manzura` admin pages.

This is **pure presentation work** — no logic, no routing, no state.
Most diff lands in `app/globals.css`. Components only get className
adjustments and (for the hero) one new lucide icon + wrapper.

## Scope decisions (locked in this brainstorm)

- **Admin polish: shared primitives only.** Button hover/active/focus-
  visible states, gold-glow utilities, input focus rings, badge
  radius/tracking — all carry over to `/manzura` because the customer
  side and admin already share `btn-primary` / `btn-gold` /
  `btn-secondary`. We do NOT add page-enter fades, product-card-style
  row lifts, or stepper glow. Admin pages stay dense and instant; the
  polish is only at the level of buttons, focus rings, and the
  consistent badge look.
- **Logo shimmer: home hero only.** A subtle gold-edged sweep across
  the "Lumée Maison" wordmark on `/[locale]` once per ~6–8s. Not
  applied to the always-visible header wordmark.

## Approach

CSS-first, single coherent pass. New utilities and selector polish
land in `app/globals.css` (`@layer components`). Components touched
only to add classNames or, in the hero's case, one small piece of
JSX (the EXPLORE scroll cue). No new deps. All infinite animations
get a corresponding entry in the `prefers-reduced-motion: reduce`
block. All animated properties are restricted to
`transform` / `opacity` / `filter` / `box-shadow` (box-shadow on
hover only, never per-frame).

## Per-section design

### 1) Buttons (`.btn-primary`, `.btn-secondary`, `.btn-gold`)

Existing rules cover base + hover. We add:

- Common `:active` state — `transform: translateY(1px)` and a slight
  shadow shrink for a "press" feel. No scale.
- `:focus-visible` — `outline: none; box-shadow: 0 0 0 3px
  rgba(201,169,110,0.35)`. Replaces the browser focus outline with
  the brand gold ring.
- `.btn-primary` hover gains `box-shadow: 0 6px 20px
  rgba(201,169,110,0.30)` on top of the existing gold-fill swap.
- `.btn-secondary` hover changes: transparent → gold border + gold
  text + very faint cream background (currently it inverts to
  obsidian — replace).
- `.btn-gold` shimmer sweeps `translateX(-120%) → translateX(120%)`
  in 600ms (currently `-100%/200%` — tightened). Hover adds
  `box-shadow: 0 0 24px rgba(201,169,110,0.35)` and shifts to
  `--accent-dark` (already there).

Admin inherits all three automatically.

### 2) Gold-glow utility classes

New in `@layer components`:

```css
.glow-gold        { box-shadow: 0 0 24px rgba(201,169,110,0.25); }
.glow-gold-strong { box-shadow: 0 0 36px rgba(201,169,110,0.45); }
.hover-glow       { transition: box-shadow 300ms ease; }
.hover-glow:hover { box-shadow: 0 0 28px rgba(201,169,110,0.30); }
```

Applied to: home CTA buttons, the home category circular icons,
the selected payment-method card on `/checkout/payment`. Used
sparingly per the "quiet luxury" rule — not on every card.

### 3) Product card (`.product-card`)

Existing card already lifts + glows + brightens. Tightening:

- Image zoom on card hover: `.product-card img { transition:
  transform 500ms ease } .product-card:hover img { transform:
  scale(1.10) }`. Card already has `overflow: hidden`.
- Card transition narrows from the current `border-color, box-shadow,
  transform, background-color` (good already — keep) — but the
  duration moves from 200ms to 300ms for everything except color
  changes, matching spec timing.

### 4) Header glassmorphism

Already correct: `app/globals.css` `.glassmorphism` has mobile blur
guard at <768px and a `border-bottom: 1px solid var(--glass-border)`
gold hairline. Only tightening: confirm transition timing is
`background 300ms ease, backdrop-filter 300ms ease` — add an explicit
`transition` line if absent (currently relies on cascade defaults).

### 5) Category circular icons (home)

`<CategoryGrid>` icon wrappers get the `.hover-glow` utility plus
`hover:scale-105` + `hover:border-gold` (Tailwind utilities — no new
CSS). 200–300ms.

### 6) Catalogue sidebar (`.cat-item`)

Existing slide-in bar already works (`transform: translateX(-12px)
→ 0` + opacity). Add: active state styling (gold-dark text + faint
gold background) — picked up from the sidebar component's active
class.

### 7) Hero (`components/home/Hero.tsx`)

- Add a bottom-centre scroll cue: small "EXPLORE" label (tracking
  0.3em, mist color) + lucide `ChevronDown` that bobs 8px vertical,
  1.6s loop, ease-in-out. New CSS keyframe `bob` + class
  `.scroll-cue-chev`. Registered in reduced-motion block.
- Existing `GoldParticles`/sparkles stay; cap at ≤20 particles and
  ≤0.75 opacity. Keep transforms only.
- Wordmark/title gets a wrapping `.logo-shimmer` class that animates
  a thin diagonal gold gradient across the text every 7s. Uses
  `background-clip: text` + `background-position` shift (transform
  is on the gradient, not the text node — keeps text legibility
  perfect at every keyframe). 1.2s sweep, 5.8s rest. Reduced-motion:
  no shimmer.

### 8) Page transitions / inputs

- `main { animation: page-enter ... }` already exists. Confirmed
  fast (300ms). Do NOT add to `/manzura/*` pages (admin needs
  instant data — scope decision above).
- Inputs: `input:focus, textarea:focus, select:focus { border-color:
  var(--accent); box-shadow: 0 0 0 3px rgba(201,169,110,0.15) }`.
  Applies globally — admin admin inputs (StockInput, status form,
  message composer, signup/login) all benefit.

### 9) Badge polish

`.badge-new`, `.badge-sale`, `.badge-best`, `.badge-bundle` already
have `border-radius: 6px` and `letter-spacing: 0.1em`. Add
`.badge-soldout` (charcoal bg + cream text) for consistency. The
admin-side status pills in `app/manzura/orders/page.tsx` and
`components/account/OrderStatusBadge.tsx` already use the same
visual tokens — verify radius / tracking match.

### 10) Logo shimmer

Covered above in §7. Scoped to home hero only.

### Reduced-motion

Append to the existing `@media (prefers-reduced-motion: reduce)`
block: `.scroll-cue-chev`, `.logo-shimmer`, and any new infinite
keyframes. Set `animation-duration: 0.01ms; animation-iteration-
count: 1`. The existing `*[class*="animate-"]` wildcard already
catches Tailwind `animate-*` classes.

## Files touched

- `app/globals.css` — the bulk of the diff: new utilities (`.glow-*`,
  `.hover-glow`, `.scroll-cue-chev`, `.logo-shimmer`,
  `.badge-soldout`), button `:active` + `:focus-visible`, button
  `.btn-secondary` hover swap, `.btn-gold` shimmer timing, product-
  card image zoom, input focus ring, reduced-motion entries.
- `components/home/Hero.tsx` — add EXPLORE+ChevronDown scroll cue and
  the `.logo-shimmer` wrapper around the wordmark. No layout
  refactor.
- `components/home/CategoryGrid.tsx` — `.hover-glow` className on
  category circle wrappers.
- `components/checkout/PaymentStep.tsx` — `.hover-glow` on each
  payment-method card; `.glow-gold` on whichever card is currently
  selected (selection state already exists in component state).
- `components/home/CTASection.tsx` — primary CTAs gain `.hover-glow`.

No component logic changes. No props added. No new state.

## Commit plan

Three commits, each small enough to revert in isolation:

1. **`style(globals): new glow utilities, button :active/:focus-visible,
   product-card image zoom, input focus ring, badge soldout`** —
   pure `globals.css` work. Land first because everything else
   references these classes.
2. **`style(hero): scroll cue + logo shimmer`** — Hero.tsx +
   keyframe additions in globals.css. Single component change.
3. **`style(home): hover-glow on CTA + category icons; payment method
   selected glow`** — className additions on the home + checkout
   pages.

## Verification

Per-commit:

1. `npx tsc --noEmit` — clean.
2. `npm run dev` and click through:
   - `/en` — buttons press feedback, focus rings show on Tab,
     CTA glow on hover, category circles glow + scale on hover,
     scroll cue bobs, wordmark sweeps once after a few seconds.
   - `/en/catalogue` — product cards lift + image zoom on hover.
   - `/en/checkout/payment` — selected method card glows.
   - `/manzura/login` — input gets gold focus ring, login button
     presses + focus-visible ring works.
   - `/manzura/orders` — same button polish, no page-enter fade,
     table density unchanged.
3. DevTools → rendering → enable "Reduced motion" → confirm
   `.animate-pulse-slow`, scroll cue, logo shimmer, and any new
   infinite animations all stop.
4. DevTools → Performance → record a 5s page interaction → no
   layout shifts, frames at ~60fps, no long task >50ms tied to
   the new animations.

## Out of scope

- No new dependencies.
- No changes to admin page layouts (the AdminNav, stepper, table
  structure all stay identical).
- No global page-enter fades on `/manzura/*`.
- No animation on the header wordmark (logo shimmer is hero-only).
- No motion-library swap (framer-motion stays where it already is).
- No changes to existing `prefers-reduced-motion` semantics — only
  additions.
