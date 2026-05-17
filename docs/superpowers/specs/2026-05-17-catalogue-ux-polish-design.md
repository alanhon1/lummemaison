# Spec 3: Catalogue UX Polish — Bundles, Group Search, Gallery Navigation, Home Sparkle

**Date**: 2026-05-17
**Status**: Approved (awaiting plan)
**Scope batch**: 3 of 4 (Lumière post-launch improvements)

## Background

After Spec 1 (theme removal + back button) and Spec 2 (data enrichment), the site has clean product data and a clean visual identity. Spec 3 layers four small but visible UX polish items on top:

1. A first-class way to browse only the 33 product *groups* (bundles), via a sidebar entry and a per-category toggle.
2. Make the existing search find products through their group identity, not just their literal name.
3. Replace the click-only thumbnail navigation on the product detail gallery with proper left/right arrow controls.
4. Add a subtle sparkle-particle layer to the home hero, complementing the three existing floating orbs.

The remaining post-launch work (Spec 4) is the description / specification translation pipeline.

## Goals

1. Add a virtual "Bundles" entry above the category list in the catalogue sidebar. Clicking it filters the catalogue grid to only show the deduplicated group cards (33 entries).
2. Add a "Group only" toggle (sibling to the existing "On sale" and "New" toggles) that filters the current category view to only show grouped products.
3. Extend the existing Fuse.js search keys to include `groupName` and `groupId`, so queries like `sosum` or `regenovue` reliably find the right group card.
4. Overlay left/right arrow controls on the main image of `ProductGallery`, keyboard-accessible, that cycle through `[mainImage, ...extraImages]` exactly like the existing thumbnail strip.
5. Add ~10 small, gold-tinted, fade-in/fade-out particles to the home hero `Hero.tsx`, layered behind the title and CTAs, matching the existing 3-orb aesthetic.

## Non-goals (YAGNI)

- A separate `/bundles` route page. The Bundles view is just a filter state in the catalogue, not a new URL segment.
- Changing how the Bundles view sorts or paginates — it inherits the catalogue's existing sort and pagination.
- Per-variant search (e.g. searching "sosum m" returning specifically the M variant rather than the group). The group card is the correct landing — the user picks the variant on the detail page via `VariantSelector`.
- Canvas-based particle systems. Framer Motion with simple animated divs is sufficient and matches the existing animation library.
- Touchscreen swipe gestures on the gallery. Tap-to-thumbnail and arrow buttons cover the use case.
- Translation work — that's Spec 4.

## Current state (verified 2026-05-17)

- Catalogue sidebar (`components/catalogue/CatalogueClient.tsx`) lists 20 categories from `data/products.json#categories`. Active category is a single string state; clicking a category toggles activation. There are two existing per-state checkbox-style toggles: "On sale" and "New".
- Fuse.js search options (lines 16-24): keys are `name`, `specification`, `description`, `categoryId` with weights 2, 1, 0.8, 0.5. After Spec 2, every grouped product carries `groupName` and `groupImage` — neither is in the Fuse keys.
- The catalogue already deduplicates grouped products in the filter pipeline (lines 91-98). Searching `sosum` already returns the SOSUM group card (because Fuse finds the variants by `name`, then dedupe collapses them) — what's missing is matching by the cleaner `groupName` (`Sosum`) which is the literal text shown on the card.
- `ProductGallery` (`components/catalogue/ProductGallery.tsx`) renders the main image plus a thumbnail strip. Thumbnails are buttons that swap the main image. There are no arrow controls on the main image itself.
- `Hero.tsx` already uses Framer Motion. Three blurred gold orbs animate vertical position. No fade-in/out particles. The composition has a `pointer-events-none` discipline so decorative layers don't block interaction.

## Design

Four independent units. Each one ships in its own commit. None of them depend on each other; the order in the plan is just convenience (group them by file).

### Unit 1 — Bundles sidebar entry + filter logic

**Files:** `components/catalogue/CatalogueClient.tsx`

A new "Bundles" item is rendered above the categories list, styled like a category entry. Internally it sets the `activeCategory` state to a sentinel value `__bundles__`. The filter pipeline gains one branch:

```ts
// before existing category filter
if (activeCategory === '__bundles__') {
  result = result.filter(p => Boolean(p.groupId));
} else if (activeCategory) {
  result = result.filter(p => p.categoryId === activeCategory);
}
```

The existing dedupe-by-group step (already present) collapses the 89 grouped products to 33 deduplicated cards. No change to dedupe — it already does the right thing once the filter narrows to grouped products only.

The sentinel `__bundles__` was chosen over a real category in `data/products.json` because Bundles is a *view*, not a product taxonomy. Keeping it out of the data avoids a fake "Bundles" category with no `range` and no products of its own.

In the sidebar render, an "All Bundles (33)" button appears immediately above the categories list, visually separated by a thin divider. Its active state mirrors how a regular category looks when selected.

### Unit 2 — "Group only" toggle within categories

**Files:** `components/catalogue/CatalogueClient.tsx`

A third boolean toggle joins `saleOnly` and `newOnly`: `groupedOnly`. UI position: same checkbox-style row in the sidebar, after "New". Label: "Bundle products only".

Filter logic: applied after the category filter (so it composes with active category):

```ts
if (groupedOnly) {
  result = result.filter(p => Boolean(p.groupId));
}
```

When the user clicks the existing "Clear filters" link, `groupedOnly` resets to `false` along with the others.

This is independent from Unit 1's `__bundles__` sentinel — when `__bundles__` is active, `groupedOnly` is redundant (the bundles view is already grouped-only) but harmless. The UI can hide the toggle when the bundles view is active to avoid confusion. Implementation: render the toggle conditionally based on `activeCategory !== '__bundles__'`.

### Unit 3 — Group-aware search

**Files:** `components/catalogue/CatalogueClient.tsx`

Extend the Fuse keys to include `groupName` and `groupId`. Updated config:

```ts
const fuseOptions = {
  threshold: 0.4,
  keys: [
    { name: 'name', weight: 2 },
    { name: 'groupName', weight: 1.5 },   // new — clean group label
    { name: 'specification', weight: 1 },
    { name: 'description', weight: 0.8 },
    { name: 'categoryId', weight: 0.5 },
    { name: 'groupId', weight: 0.3 },     // new — slug fallback
  ],
};
```

`groupName` weight is high (1.5) because the user-visible text is what people type into search boxes. `groupId` is low (0.3) because it's a slug, not user-facing, but useful as a low-confidence fallback.

No other search code changes. Fuse handles undefined fields gracefully (non-grouped products simply don't match on the new keys).

### Unit 4 — Gallery arrow controls

**Files:** `components/catalogue/ProductGallery.tsx`

Add a previous-arrow button and a next-arrow button overlaying the main image. Both are positioned absolutely (left-3 and right-3, vertically centered), with a circular gold-accented background that has 70% opacity, becoming fully opaque on hover. Each rendered ONLY when `allImages.length > 1`.

```tsx
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
```

Keyboard support: an `useEffect` registers `keydown` listeners on `window` while the component is mounted. Left arrow → previous, Right arrow → next. Cleanup on unmount.

The existing thumbnail strip stays. Arrows + thumbnails are complementary, not alternative.

### Unit 5 — Home hero sparkle particles

**Files:** `components/home/Hero.tsx`

Render an additional layer of 10 small particles inside the existing hero section, between the existing orbs and the foreground text. Each particle:
- Random initial position (within the right two-thirds of the viewport, to avoid covering the text on the left)
- Small size: 4-12px diameter
- Gold tint: `bg-gold/40` background
- Blur: `blur-sm`
- Animation: opacity fades 0 → 0.7 → 0 over 3-6 seconds (different per particle), then scale and position drift slightly. After the cycle, the particle's position is re-randomized for the next cycle.
- `pointer-events-none` so it doesn't block clicks

Implementation: a `Sparkles` sub-component below `Hero` that maps over an array of 10 deterministic-looking-but-randomized seeds. Use `useMemo` to compute positions once on mount (avoids re-randomizing on every render). Each particle is a `motion.div` with `animate` driving opacity, scale, and y position; `transition` has a per-particle delay and duration drawn from the seed.

Pseudocode:

```tsx
function Sparkles() {
  const particles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: i,
    size: 4 + (i * 0.8 % 8),
    top: `${15 + (i * 17.3) % 75}%`,
    left: `${30 + (i * 23.1) % 65}%`,
    delay: (i * 0.7) % 3.5,
    duration: 3 + (i * 0.4) % 3,
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

This component is rendered inside the hero `<section>`, after the three existing orbs and before the foreground content `<div className="relative max-w-7xl mx-auto...">`.

No new dependencies — `framer-motion` is already used by Hero.

## Order of operations

```
Unit 1 (Bundles entry)
 → Unit 2 (Group-only toggle)
 → Unit 3 (Search keys)
 → Unit 4 (Gallery arrows)
 → Unit 5 (Sparkles)
```

Units 1-3 share `CatalogueClient.tsx`; they can be done in three sequential commits but it's also fine to bundle them into one if the diff stays readable. The plan will recommend three separate commits for review clarity. Units 4 and 5 are each one commit on their respective files.

## Testing

No test framework. Verification = `npm run build` + `npm run lint` + manual browser walkthrough.

Manual checklist:
1. Open `/en/catalogue`. Sidebar shows new "Bundles" entry above the categories list. Click it → grid shows 33 deduplicated cards, all of which have group names. Click it again → returns to "All".
2. Click any normal category (e.g. "Fillers"). A "Bundle products only" toggle appears in the filter row. Toggle on → grid narrows to grouped products in Fillers (e.g. SOSUM, REGENOVUE cards). Toggle off → grid restores. Switch to Bundles view → the toggle is hidden.
3. Type `sosum` into the search box → grid shows the Sosum card (and possibly other relevant matches if any). Type `regenovue` → Regenovue card. Type a non-existent term → empty state as before.
4. Visit any product detail page with multiple images (e.g. one of the SOSUM variants). Confirm left/right arrows overlay the main image. Click each → main image cycles. Test keyboard: left/right keys cycle.
5. Visit `/en/`. Confirm 10 small gold sparkles fade in and out around the hero area, separate from the 3 large orbs. Sparkles do not block clicks on the CTAs.

## Risks and open items

- **Sparkles motion intensity.** If 10 particles feel busy, the count can be tuned. The plan will set 10 and call out the knob; user can lower to 6-8 after seeing it.
- **Arrow controls on touch devices.** Arrows are visible on touch too. Users can tap them; no swipe gesture needed for v1.
- **Search weight tuning.** If `groupName` weight of 1.5 over-prioritizes group cards over relevant variant-level matches, lower to 1.0 and re-evaluate. Calibration is a single-line change.
- **`__bundles__` sentinel.** Stored only in client state, not in URL. If the user shares a Bundles-view URL, the recipient lands on the default catalogue view. Acceptable for v1 — Bundles is a discovery aid, not a deep-link target. If needed, Spec 4 or later can hoist it into the URL via `?view=bundles`.
