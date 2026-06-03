# Visual Polish & Micro-Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the `CLAUDE_design.md` visual-polish spec across customer-facing pages and let the shared primitives carry over to `/manzura` automatically. Pure presentation work — no logic / routing / state changes.

**Architecture:** CSS-first. Bulk of the diff in `app/globals.css` (`@layer components`). Three components touched only for className additions or a single JSX wrapper. All new infinite animations registered in the existing `prefers-reduced-motion: reduce` block. Animated properties restricted to `transform` / `opacity` / `filter` / `box-shadow` (box-shadow only on hover transitions, never per-frame).

**Tech Stack:** Tailwind CSS v4 (`@theme` + `@layer components`), framer-motion, lucide-react, Next.js 16 App Router.

**Already-done items the design spec listed (verified during planning — don't re-implement):**
- Hero scroll cue: `components/home/Hero.tsx:152-173` already has EXPLORE label + ChevronDown bobbing via framer-motion, with `useReducedMotion()` handling.
- Hero gold particles: `Sparkles()` sub-component in same file, 20 particles, opacity ≤ 0.75, transform-only.
- Category circular icons hover: `components/home/CategoryGrid.tsx:70` already has `group-hover:scale-105 group-hover:border-gold group-hover:shadow-[0_0_20px_rgba(201,169,110,0.35)]`.
- Sidebar `.cat-item` slide bar: `app/globals.css` lines 361-374.
- Header glassmorphism mobile blur guard: `app/globals.css` lines 90-99.
- Page-enter fade for customer pages: `app/globals.css` lines 354-358.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `app/globals.css` | All visual tokens, utilities, button/badge/card rules, reduced-motion block. | Modify in 5 self-contained sections (Tasks 1–5). |
| `components/home/Hero.tsx` | Hero hero title node. | Wrap the `<motion.h1>` title with `<span class="logo-shimmer">` (Task 6). |
| `components/home/CTASection.tsx` | Primary CTA button on home page. | Add `hover-glow` className to the Email/Contact CTA (Task 8). |
| `components/checkout/PaymentStep.tsx` | Wise + USDT payment-method cards. | Add `hover-glow` className to each `<article>` method card (Task 8). |

Admin pages (`/manzura/*`) inherit the polish automatically through the shared `.btn-*` / focus-ring / `.badge-*` classes. No admin-specific edits.

---

## Task 1: New utility classes in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Open `app/globals.css` and locate the end of the `@layer components` block (currently line 383, just before the closing `}`)**

The new utilities live inside `@layer components` so they participate in Tailwind's cascade ordering.

- [ ] **Step 2: Insert the four utility blocks immediately before the `@keyframes float-1 ...` block (around line 376)**

```css
  /* Gold glow utilities — apply sparingly to focal elements only */
  .glow-gold        { box-shadow: 0 0 24px rgba(201, 169, 110, 0.25); }
  .glow-gold-strong { box-shadow: 0 0 36px rgba(201, 169, 110, 0.45); }
  .hover-glow       { transition: box-shadow 300ms ease; }
  .hover-glow:hover { box-shadow: 0 0 28px rgba(201, 169, 110, 0.30); }

  /* Sold-out badge — complements existing .badge-new / .badge-sale family.
     Uses --color-charcoal (#1a1a1a) per spec — Tailwind v4 exposes @theme
     colors as --color-* custom properties. */
  .badge-soldout {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    background-color: var(--color-charcoal, #1a1a1a);
    color: var(--color-cream, #faf8f5);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 6px;
  }

  /* Logo shimmer — gold gradient sweep across the wordmark on the home hero.
     Background-clip:text means the gradient draws inside the glyphs, not the
     bounding box, so the text remains crisply legible at every keyframe.
     7s loop (1.2s sweep + 5.8s rest), reduced-motion entry below disables. */
  .logo-shimmer {
    background-image: linear-gradient(
      105deg,
      currentColor 0%,
      currentColor 38%,
      rgba(221, 192, 142, 0.95) 50%,
      currentColor 62%,
      currentColor 100%
    );
    background-size: 250% 100%;
    background-position: 100% 0;
    -webkit-background-clip: text;
            background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: logo-shimmer-sweep 7s ease-in-out infinite;
  }
  @keyframes logo-shimmer-sweep {
    0%, 82%   { background-position: 100% 0; }
    100%      { background-position: -100% 0; }
  }
```

- [ ] **Step 3: Typecheck (validates CSS via Next compile path too)**

```bash
npx tsc --noEmit
```
Expected: no output (clean).

- [ ] **Step 4: Visual sanity — dev server**

```bash
npm run dev
```
Visit `http://localhost:3000/en` — at this stage no element uses the new classes yet, so the page should look unchanged. Confirms the new CSS doesn't introduce a syntax error.

---

## Task 2: Button :active + :focus-visible polish

**Files:**
- Modify: `app/globals.css` (the three `.btn-*` blocks, currently lines 102–175)

- [ ] **Step 1: Replace the `.btn-primary` block (lines 102–122) with this version**

```css
  /* Buttons */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.8rem 2rem;
    background-color: var(--page-text);
    color: var(--page-bg);
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1),
                border-color     300ms cubic-bezier(0.4, 0, 0.2, 1),
                color            200ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow       300ms cubic-bezier(0.4, 0, 0.2, 1),
                transform        100ms cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
    border-radius: 10px;
  }
  .btn-primary:hover {
    background-color: var(--accent);
    border-color: var(--accent);
    color: #fff;
    box-shadow: 0 6px 20px rgba(201, 169, 110, 0.30);
  }
  .btn-primary:active {
    transform: translateY(1px);
    box-shadow: 0 2px 8px rgba(201, 169, 110, 0.20);
  }
  .btn-primary:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.35);
  }
```

- [ ] **Step 2: Replace the `.btn-secondary` block (current lines 124–142) with this version**

The hover behaviour changes per spec: transparent → gold border + gold text + faint cream background (currently inverts to obsidian).

```css
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.8rem 2rem;
    background-color: transparent;
    color: var(--page-text);
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    border: 1px solid var(--page-text);
    border-radius: 10px;
    transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1),
                border-color     300ms cubic-bezier(0.4, 0, 0.2, 1),
                color            200ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow       300ms cubic-bezier(0.4, 0, 0.2, 1),
                transform        100ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .btn-secondary:hover {
    border-color: var(--accent);
    color: var(--accent-dark);
    background-color: rgba(250, 248, 245, 0.6);
  }
  .btn-secondary:active {
    transform: translateY(1px);
  }
  .btn-secondary:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.35);
  }
```

- [ ] **Step 3: Replace the `.btn-gold` block (current lines 144–175) with this version**

Shimmer sweep narrows from `-100% → 200%` to spec's `-120% → 120%`. Active and focus-visible added.

```css
  .btn-gold {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.8rem 2rem;
    background-color: var(--accent);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    border: 1px solid var(--accent);
    border-radius: 10px;
    position: relative;
    overflow: hidden;
    transition: background-color 300ms cubic-bezier(0.4, 0, 0.2, 1),
                border-color     300ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow       300ms cubic-bezier(0.4, 0, 0.2, 1),
                transform        100ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .btn-gold::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--gold-shimmer);
    transform: translateX(-120%);
    transition: transform 600ms ease;
    pointer-events: none;
  }
  .btn-gold:hover::after { transform: translateX(120%); }
  .btn-gold:hover {
    background-color: var(--accent-dark);
    border-color: var(--accent-dark);
    box-shadow: 0 0 24px rgba(201, 169, 110, 0.35);
  }
  .btn-gold:active {
    transform: translateY(1px);
    box-shadow: 0 0 12px rgba(201, 169, 110, 0.25);
  }
  .btn-gold:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.35);
  }
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Visual check in dev server**

Visit `http://localhost:3000/en`. Tab to a button → gold focus ring shows. Click and hold a button → 1px press-down. Hover `.btn-primary` → gold fill + outer glow. Hover `.btn-gold` → shimmer sweep + glow. Hover `.btn-secondary` → gold border + gold text + faint cream bg (no longer obsidian invert).

---

## Task 3: Product card image zoom on hover

**Files:**
- Modify: `app/globals.css` (the `.product-card` block, currently lines 201–213)

- [ ] **Step 1: Replace the `.product-card` block with this version**

Adds `.product-card img` transition and a `:hover img` scale.

```css
  /* Product card — light translucent (no blur, keeps perf) */
  .product-card {
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(201, 169, 110, 0.22);
    transition: border-color     300ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow       300ms cubic-bezier(0.4, 0, 0.2, 1),
                transform        300ms cubic-bezier(0.4, 0, 0.2, 1),
                background-color 300ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    border-radius: 12px;
  }
  .product-card:hover {
    background: rgba(255, 255, 255, 0.92);
    border-color: var(--accent);
    box-shadow: 0 12px 40px rgba(201, 169, 110, 0.22);
    transform: translateY(-4px);
  }
  .product-card img {
    transition: transform 500ms ease;
  }
  .product-card:hover img {
    transform: scale(1.10);
  }
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Visual check**

Visit `http://localhost:3000/en/catalogue`. Hover a product card — image zooms to 1.10× over 500ms while the card lifts 4px. No layout shift outside the card.

---

## Task 4: Input focus gold ring + header glass transition timing

**Files:**
- Modify: `app/globals.css` (the input base block, currently lines 337–343; the `.glassmorphism` block, currently lines 90–99)

- [ ] **Step 1: Replace the input base block with this version**

Adds `:focus` styling that applies across the whole app (customer + admin).

```css
  /* Input base */
  input[type="text"],
  input[type="email"],
  input[type="tel"],
  input[type="number"],
  input[type="password"],
  input[type="search"],
  textarea,
  select {
    border-radius: 6px;
    transition: border-color 200ms ease, box-shadow 200ms ease;
  }
  input[type="text"]:focus,
  input[type="email"]:focus,
  input[type="tel"]:focus,
  input[type="number"]:focus,
  input[type="password"]:focus,
  input[type="search"]:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(201, 169, 110, 0.15);
  }
```

- [ ] **Step 2: Replace the `.glassmorphism` block with this version**

Adds an explicit transition so the glass effect fades in smoothly on scroll.

```css
  /* Header glass — backdrop-blur only at md+ for mobile scroll perf */
  .glassmorphism {
    background: var(--glass-bg);
    border-bottom: 1px solid var(--glass-border);
    transition: background-color 300ms ease, backdrop-filter 300ms ease;
  }
  @media (min-width: 768px) {
    .glassmorphism {
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
  }
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Visual check**

Focus an input on `/en/account/login` and `/en/contact` → gold border + soft outer ring. Scroll down on `/en` → header transitions to glass smoothly, no abrupt opacity flip.

---

## Task 5: Reduced-motion additions

**Files:**
- Modify: `app/globals.css` (the `@media (prefers-reduced-motion: reduce)` block, currently lines 386–394)

- [ ] **Step 1: Replace the reduced-motion block with this version**

Adds explicit `.logo-shimmer` entry. The existing `*[class*="animate-"]` wildcard already covers Tailwind's `animate-*` classes, but it does NOT match `.logo-shimmer` because that class name does not start with `animate-`.

```css
/* Reduced motion: disable infinite animations */
@media (prefers-reduced-motion: reduce) {
  .animate-pulse-slow,
  .skeleton,
  .logo-shimmer,
  *[class*="animate-"] {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
  .cart-panel { transition: none !important; }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: DevTools reduced-motion smoke test**

In Chrome DevTools → Rendering tab → set "Emulate CSS media feature prefers-reduced-motion" to `reduce`. Visit `/en`. The hero wordmark shimmer should not sweep. `animate-pulse-slow` (any backdrop glow) should stay still. Reset to "No emulation" after.

---

## Task 6: Commit globals.css polish

- [ ] **Step 1: Stage and commit**

```bash
git add app/globals.css
git commit -m "$(cat <<'EOF'
style(globals): glow utilities, button polish, card image zoom, input focus

Phase 1 of CLAUDE_design.md polish. Pure CSS in app/globals.css —
no behavioural change, no component edits.

- New utilities: .glow-gold, .glow-gold-strong, .hover-glow,
  .badge-soldout, .logo-shimmer (+ logo-shimmer-sweep keyframe).
- Button polish across .btn-primary / .btn-secondary / .btn-gold:
  explicit :active state (translateY(1px) + shadow shrink),
  :focus-visible gold ring (0 0 0 3px rgba(201,169,110,0.35)),
  .btn-secondary hover switched from obsidian-invert to gold-border
  + gold-text + faint-cream bg, .btn-gold shimmer sweep tightened
  to -120% -> 120% and hover gains 0 0 24px gold glow. All button
  transition properties enumerated explicitly so the press-down
  feels snappy (transform 100ms) while colour/glow stay 300ms.
- .product-card now scales inner <img> to 1.10x on hover via a
  500ms transition (card already had overflow:hidden).
- Inputs / textareas / selects get a 0 0 0 3px gold focus ring +
  gold border. Applies globally — admin inputs benefit too.
- .glassmorphism gets an explicit transition so the scroll-into-
  glass fade is smooth instead of a snap.
- prefers-reduced-motion block adds .logo-shimmer entry (the
  existing animate-* wildcard wouldn't catch this class name).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, only `app/globals.css` changed.

---

## Task 7: Wrap the hero title with the logo shimmer

**Files:**
- Modify: `components/home/Hero.tsx:79-92` (the `<motion.h1>` title block)

- [ ] **Step 1: Replace the `<motion.h1>` block with this version**

The shimmer wraps the entire title (both the main `{t('title')}` text and the gold-dark `{t('titleAccent')}` italic span) so the sweep travels across the whole wordmark.

```tsx
          {/* Title — lit from behind by a soft cream halo so it pops on the maison */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-[2rem] sm:text-5xl md:text-7xl font-medium leading-[1.1] text-obsidian mb-4"
            style={{
              textShadow:
                '0 0 20px rgba(255,248,235,0.85), 0 0 40px rgba(255,248,235,0.55), 0 2px 4px rgba(0,0,0,0.12)',
            }}
          >
            <span className="logo-shimmer">
              {t('title')}
              <br />
              <span className="text-gold-dark italic">{t('titleAccent')}</span>
            </span>
          </motion.h1>
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Visual check**

Visit `http://localhost:3000/en`. Wait ~6 seconds — a thin gold gradient sweeps left across the wordmark over ~1.2s, then rests for ~5.8s, then repeats. The text remains crisply legible at every keyframe (no anti-aliasing artefacts, no `text-fill-color` "ghosting").

- [ ] **Step 4: Reduced-motion check**

Chrome DevTools → Rendering → set prefers-reduced-motion to `reduce` → reload `/en` → the wordmark stays static, no sweep.

---

## Task 8: Commit Hero shimmer

- [ ] **Step 1: Stage and commit**

```bash
git add components/home/Hero.tsx
git commit -m "$(cat <<'EOF'
style(hero): logo shimmer sweep on the home wordmark

Phase 2 of CLAUDE_design.md polish. Adds the gold-gradient sweep
across the "Lumée Maison" wordmark on the home landing page (spec
item #10).

components/home/Hero.tsx:79-92 — wraps the title text (both
{t('title')} and {t('titleAccent')}) with a <span className="logo-shimmer">
container. The .logo-shimmer class (from globals.css, prior commit)
animates a 250%-wide gold gradient via background-position, clipped
to the text via background-clip:text. 7s loop = 1.2s sweep + 5.8s
rest. prefers-reduced-motion already disables.

The scroll cue and gold-particles spec items were already implemented
in Hero.tsx — left untouched.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, only `components/home/Hero.tsx` changed.

---

## Task 9: Apply `.hover-glow` to home CTA + payment-method cards

**Files:**
- Modify: `components/home/CTASection.tsx:51` (the primary Email/Contact CTA)
- Modify: `components/checkout/PaymentStep.tsx` (the Wise + USDT method `<article>` cards)

- [ ] **Step 1: Add `hover-glow` to the CTASection primary CTA**

In `components/home/CTASection.tsx`, replace the existing `<Link>` to `/contact` (lines 49–55):

```tsx
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto btn-primary hover-glow text-xs px-6 py-3"
            >
              <Mail size={16} />
              {t('email')}
            </Link>
```

(Only change: append ` hover-glow` to the className.)

- [ ] **Step 2: Locate the Wise method card header in PaymentStep.tsx**

```bash
grep -n "payment.wise.heading\|payment.usdt.heading" components/checkout/PaymentStep.tsx
```

Expected: two matches roughly around lines 188 and a second `<article>` for USDT shortly after.

- [ ] **Step 3: Read the immediate context of both `<article>` cards**

```bash
sed -n '186,235p' components/checkout/PaymentStep.tsx
```

You're looking for the two `<article className="bg-white border border-bone rounded-lg p-5 md:p-6">` opening tags — one for Wise, one for USDT.

- [ ] **Step 4: Append `hover-glow` to both `<article>` className strings in one go**

Use the Edit tool with `replace_all: true` on this exact string:

```
<article className="bg-white border border-bone rounded-lg p-5 md:p-6">
```

→ replace with:

```
<article className="bg-white border border-bone rounded-lg p-5 md:p-6 hover-glow">
```

(Both Wise and USDT cards share that exact className. Confirm the file has no other `<article>` with that class first via `grep -c 'bg-white border border-bone rounded-lg p-5 md:p-6' components/checkout/PaymentStep.tsx` — expect `2`.)

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Visual check**

Visit `http://localhost:3000/en` — hover the "Email" CTA at the bottom → gold outer glow surrounds the button without affecting layout.

Visit `http://localhost:3000/en/checkout/payment` (you'll need an order in progress — or just look at the markup via curl if the checkout flow gate is in the way). Hover either the Wise or USDT card → soft gold outer glow appears.

---

## Task 10: Commit hover-glow application

- [ ] **Step 1: Stage and commit**

```bash
git add components/home/CTASection.tsx components/checkout/PaymentStep.tsx
git commit -m "$(cat <<'EOF'
style(home,checkout): hover-glow on primary CTA and payment-method cards

Phase 3 of CLAUDE_design.md polish — applies the .hover-glow utility
(from globals.css, two commits back) to the focal elements per the
spec's "quiet luxury" rule: focal CTAs + payment-method cards, not
every card on the page.

- components/home/CTASection.tsx — primary "Email" CTA on the home
  bottom block gains hover-glow alongside its existing btn-primary
  styling.
- components/checkout/PaymentStep.tsx — both Wise and USDT
  payment-method <article> cards gain hover-glow so the customer's
  eye lands on the active method at hover time.

Category-icon hover glow was already wired up inline in
components/home/CategoryGrid.tsx with the exact spec values, so
nothing to add there.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Expected: one commit, two files changed.

---

## Final verification checklist (post Task 10)

Run through these once after the three commits land:

- [ ] **Customer side — buttons**: visit `/en`, Tab to a button → gold focus ring. Click and hold → 1px press feedback. Hover `.btn-primary` → gold + outer glow. Hover `.btn-gold` → shimmer sweep + outer glow. Hover `.btn-secondary` → gold border + gold text + faint cream bg.
- [ ] **Customer side — cards**: `/en/catalogue`, hover a product card → 4px lift + image scales to 1.10× over 500ms.
- [ ] **Customer side — hero**: `/en`, wordmark sweeps gold every ~7s. Scroll cue bobs (already in place pre-plan).
- [ ] **Customer side — focal glow**: `/en` Email CTA, `/en/checkout/payment` Wise + USDT cards all show a soft outer gold glow on hover.
- [ ] **Customer side — inputs**: focus any input on `/en/contact`, `/en/account/login`, `/en/account/signup` → gold border + soft outer ring.
- [ ] **Customer side — header**: scroll down on `/en` past 20px → smooth transition into glass (mobile: solid translucent only, no blur).
- [ ] **Admin side (shared primitives)**: `/manzura/login` → input focus ring works, login button :focus-visible + :active + hover all behave like customer side. `/manzura/orders/<id>` (need admin login) — the "Mark Shipped" + status-flip buttons (all `.btn-gold`) show consistent hover/press/focus. No page-enter fade on `/manzura/*` (intentional).
- [ ] **Reduced motion**: DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion" = `reduce`. Logo shimmer stops. `animate-pulse-slow` stops. Hero scroll cue stops (already handled by framer-motion's `useReducedMotion`).
- [ ] **Perf smoke**: Chrome DevTools → Performance → record 5s on `/en` → no layout shifts; hover interactions stay at ~60fps; no long task >50ms tied to the new transitions.
- [ ] **Typecheck**: `npx tsc --noEmit` clean (already done per task, but worth re-confirming after all 3 commits).
- [ ] **Git status clean**: `git status --short` shows nothing — all changes in 3 commits.
