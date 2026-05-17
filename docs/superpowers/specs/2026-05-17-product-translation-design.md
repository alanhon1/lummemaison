# Spec 4: Product Description & Specification Translation Pipeline

**Date**: 2026-05-17
**Status**: Approved (awaiting plan)
**Scope batch**: 4 of 4 (Lumière post-launch improvements — final batch)

## Background

Lumière has next-intl wired for en/ru/ko with `messages/{locale}.json` covering all UI strings (nav, buttons, badges, form labels). But product data — name, description, specification, category, enrichedInfo — comes from `data/products.json` and is English-only. A Korean or Russian buyer browsing the catalogue sees the UI in their language but every product body text in English.

Spec 4 fills that gap for the two highest-value fields: `description` and `specification`. These are the texts that appear on product cards, product detail pages, and cart items — the texts a buyer actually reads when evaluating a product.

This is the **final spec** in the post-launch series. Spec 1 (theme removal + back button), Spec 2 (data enrichment), and Spec 3 (catalogue UX polish) are all shipped on origin/main.

## Goals

1. Translate every product's `description` and `specification` (where present) into Russian and Korean using Claude Code subagent dispatch.
2. Store the translations in two new files: `data/translations/ru.json` and `data/translations/ko.json`, both id-keyed.
3. Add a tiny lookup helper in `lib/products.ts` so call sites can request a locale-aware version with English fallback.
4. Update the three display call sites (`ProductCard`, `app/[locale]/product/[id]/page.tsx`, `components/layout/CartPanel.tsx`) to use the helper.

## Non-goals (YAGNI)

- Translating product `name`, brand-style group names (Sosum, Regenovue, etc.), or category names — those are international brand identifiers that stay English in B2B Korean cosmetics catalogues. User explicitly chose scope A in brainstorming.
- Translating `enrichedInfo` (benefits, protocol, ingredients) — present on a minority of products, lower priority.
- Translating cart messages, admin UI, or any user-input text.
- Automatic language detection. The header locale switcher is enough.
- A regenerate-on-edit workflow. If the user later edits a description via the admin UI, the corresponding translations become stale until the user (or a future spec) re-runs the translation pipeline. Acceptable for v1.
- Pluralization, gender, formal/informal Russian variants. Plain prose is fine for product descriptions.

## Current state (verified 2026-05-17)

- `messages/en.json`, `messages/ko.json`, `messages/ru.json` — UI strings, all three languages already complete.
- `lib/i18n.ts` — exports `locales = ['en', 'ru', 'ko']`, `defaultLocale = 'en'`, and `isValidLocale`.
- `data/products.json` — 438 products, 414 with description >= 50 chars (after Spec 2). `specification` field present on most products (a short metadata-style line like "10 mL x 5 vials").
- Three display call sites that render description / specification:
  - `components/catalogue/ProductCard.tsx` lines 70 and 142 — `product.specification` only (one-line subtitle on the card).
  - `app/[locale]/product/[id]/page.tsx` lines 111 and 120 — both `product.specification` (in the spec card) and `product.description` (in the description section, when `!hasEnriched`).
  - `components/layout/CartPanel.tsx` line 82 — `item.specification` (the spec text stored at the moment of add-to-cart).
- The cart store (`lib/store.ts`) captures `specification` as a plain string at add-to-cart time. For locale-aware cart display, the cart panel needs to re-derive the specification from the live product data using the current locale (rather than rely on whatever locale was active at add time).

## Design

Three concerns: (1) generate the translations, (2) store and look them up, (3) wire the call sites.

### Storage shape

Two new files at `data/translations/`:

```
data/translations/ru.json
data/translations/ko.json
```

Each file is a single JSON object keyed by product `id` (as a string, since JSON keys must be strings):

```json
{
  "1": {
    "description": "Бар​би Слим — новый продукт...",
    "specification": "10 мл x 5 флаконов..."
  },
  "2": {
    "description": "...",
    "specification": "..."
  }
}
```

Entries are only included for products that have a non-empty `description` or `specification` in the source. Missing fields fall back to English at read time.

**Why separate files, not embedded in products.json:**
- `products.json` already grew significantly in Spec 2 (gallery images, group fields). Embedding two more locales would balloon it by ~50% and make git diffs noisier.
- Translations are regenerated together per-locale. Storing each locale in its own file means we can iterate on one language without touching the other.
- The English source stays canonical and untouched in `products.json`.

### Translation generation pipeline

Subagent dispatch, same nested-orchestration pattern as Spec 2's vision audit. Reason: user has no `ANTHROPIC_API_KEY`. The work is amortized across the Claude Code session at $0.

**Phase 1 — Prep:** `scripts/translate-prep.ts` reads `products.json`, collects every (id, fieldName, sourceText) tuple where `sourceText` is non-empty, splits into batches of 25 tuples each, and writes them to `scripts/translate-batches/{locale}/batch-{N}.json`. Two locales × ~800 tuples / 25 = ~32-35 batches per locale, ~65 batches total.

**Phase 2 — Dispatch:** the implementer task for the translation step lists the batch files, then for each batch dispatches one Agent (general-purpose, sonnet) with a translation prompt. Each subagent returns a JSON array of `{id, fieldName, translatedText}` records. Controller appends to `scripts/translate-results/{locale}.json` after each batch.

The translation prompt is tuned for the domain:
- Korean cosmetics / aesthetic medical products
- B2B wholesale buyer audience
- Preserves brand names, dosages (e.g. "10 mL"), and product-line names (e.g. "PDLLA", "HA") untranslated
- Natural marketing tone in the target language

**Phase 3 — Apply:** `scripts/translate-apply.ts` reads `scripts/translate-results/{locale}.json` and rewrites it into the final `data/translations/{locale}.json` shape (id → {description, specification}).

**Model:** Claude Sonnet (`claude-sonnet-4-6` or whatever the active default). Description text is medical/cosmetic — Sonnet's quality matters more than Haiku's speed.

**Wall time:** ~65 dispatches × ~3 minutes = 2-4 hours total. This is the longest spec to execute.

### Lookup helper

Add to `lib/products.ts`:

```ts
import translationsRu from '@/data/translations/ru.json';
import translationsKo from '@/data/translations/ko.json';

type Locale = 'en' | 'ru' | 'ko';
type ProductTranslation = { description?: string; specification?: string };

const TRANSLATIONS: Record<Locale, Record<string, ProductTranslation>> = {
  en: {},
  ru: translationsRu as Record<string, ProductTranslation>,
  ko: translationsKo as Record<string, ProductTranslation>,
};

export function getLocalizedDescription(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale as Locale]?.[String(product.id)]?.description;
  return t || product.description;
}

export function getLocalizedSpecification(product: Product, locale: string): string {
  const t = TRANSLATIONS[locale as Locale]?.[String(product.id)]?.specification;
  return t || product.specification;
}
```

Falls back to English silently if locale unknown, product missing from translation file, or field missing from product entry.

The JSON imports are static — Next.js bundles them. Each translation file is ~250KB unminified; both together add ~500KB to the client bundle when both locales' code paths run. Acceptable for a B2B catalogue site (it loads once and benefits from CDN caching). If file size becomes a concern, a future spec can switch to dynamic `import()` per-locale.

### Call site updates

Three files:

1. **`components/catalogue/ProductCard.tsx`** — Add `import { getLocalizedSpecification } from '@/lib/products';` and `useLocale` from next-intl. Replace `{product.specification}` (two occurrences at lines 70 and 142) with `{getLocalizedSpecification(product, locale)}`.

2. **`app/[locale]/product/[id]/page.tsx`** — Server component, already has `locale` from `params`. Add imports, replace `{product.specification}` (line 111) with `{getLocalizedSpecification(product, locale)}` and `{product.description}` (line 120) with `{getLocalizedDescription(product, locale)}`.

3. **`components/layout/CartPanel.tsx`** — Each cart item has an `id`. Look up the live product by id, then use `getLocalizedSpecification(product, locale)` instead of the stored `item.specification`. This makes the cart panel reactive to locale changes (a user switching locale sees their cart re-render in the new language without re-adding items).

### Edge cases

- **Locale = 'en':** lookup returns nothing from TRANSLATIONS map, fallback to English source. Correct.
- **Product not in translation file:** product was added after the last translation run, or has empty source fields. Fallback to English source. Correct.
- **Source description longer than expected:** subagent returns matching-length translation. Validation step in `translate-apply.ts` warns if translation is suspiciously short (< 50% of source length) but accepts it.
- **Korean source already contains Korean characters:** unlikely (descriptions came from aesthetics-shop and gofillerss, both English). If it happens, the Korean translation may pass through verbatim — acceptable.
- **Cart with old session storage:** existing cart items in `localStorage` carry an old English `specification`. After the lookup-by-id change, the cart panel re-derives at render time, so old localStorage data still works.

### File summary

| Action | File | Purpose |
|---|---|---|
| new | `scripts/translate-prep.ts` | Split products into translation batches |
| new | `scripts/translate-apply.ts` | Merge subagent results into final translation files |
| new | `data/translations/ru.json` | Russian translations (id-keyed) |
| new | `data/translations/ko.json` | Korean translations (id-keyed) |
| modify | `lib/products.ts` | Add `getLocalizedDescription` and `getLocalizedSpecification` |
| modify | `components/catalogue/ProductCard.tsx` | Use lookup helper (2 lines) |
| modify | `app/[locale]/product/[id]/page.tsx` | Use lookup helper (2 lines) |
| modify | `components/layout/CartPanel.tsx` | Re-derive specification via lookup helper |
| modify | `package.json` | Add `translate-prep` and `translate-apply` npm scripts |
| modify | `.gitignore` | Add intermediate dirs (`scripts/translate-batches/`, `scripts/translate-results/`) |

## Testing

No test framework. Verification:

1. `npm run build` after each task — `Compiled successfully`, 38 pages.
2. `npm run lint` — no new errors beyond the pre-Spec-4 baseline of 69.
3. Manual:
   - Switch locale to RU on a product page — description and specification render in Russian.
   - Switch to KO on same page — render in Korean.
   - Switch to EN — render in English source.
   - On the catalogue grid (RU or KO) — every product card's subtitle is in the chosen language.
   - Add a product to cart in EN, switch to RU, open cart — the spec line is now in Russian.
   - On a product whose description is empty in the source (none after Spec 2, but defensively): RU/KO fall back to whatever the English value is (also empty).
   - Spot-check 5-10 translations for naturalness (read like a B2B product blurb, not literal word-for-word).

## Risks and open items

- **Bundle size impact.** Two translation JSON files at ~250KB each = ~500KB added to client bundle. For a B2B catalogue site with CDN, acceptable. If concerns surface in production, switch to dynamic per-locale imports.
- **Translation quality drift.** Subagent translations are generally good but not professional. Spot-checking is the user's responsibility; the spec accepts this. If quality is unacceptable, a future spec can run them through a paid service like DeepL with the same subagent dispatch pattern (subagent calls DeepL via fetch).
- **Stale translations after admin edits.** If the user edits a description via the admin UI, the existing translation becomes stale. The admin UI does not currently warn about this. Future improvement: admin UI flags stale translations and offers a one-click re-translate for that product. Out of scope for v1.
- **Wall time.** ~65 subagent dispatches × ~3 minutes = 2-4 hours. This is the longest-running spec. Schedule accordingly (e.g. run before bed, check in morning).
