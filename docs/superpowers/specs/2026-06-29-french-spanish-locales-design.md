# French + Spanish Locales — Design

**Date:** 2026-06-29
**Sub-project:** lumee3 ② (`lumee3/add-french-spanish-task.md`)
**Stack:** Next.js 16 (App Router, Turbopack) · next-intl · Supabase Storage (live catalogue) · Vercel

## Overview
Add **French (`/fr`)** and **Spanish (`/es`)** the way Russian (`/ru`) is already done: locales = **en (root), ru, fr, es** with `localePrefix: 'as-needed'`. All new text is **high-quality, context-aware AI translation produced by Claude** — never a runtime translation API. Russian stays untouched.

## How the catalogue actually works (discovered)
- The live catalogue is loaded from the **Supabase Storage "live store"** via `lib/catalogue-store.ts` → `loadProducts()` (used by `lib/catalogue.ts` `getAllProducts()`). Admin edits/adds persist there. Live count ≈ **477**.
- `data/products.json` is a **committed snapshot** (currently **473**, stale) — it is the **input to the translation pipeline** and the client-side bundled `categories`/sync helpers in `lib/products.ts`.
- Localized product fields resolve via `lib/products.ts` `localized()`: for `ru`, prefer the product's `description_ru`/`specification_ru` etc.; otherwise the **legacy `data/translations/{locale}.json`** map; otherwise English. **This already generalizes to fr/es**: dropping `data/translations/fr.json` / `es.json` makes the resolver pick them up with English fallback — no resolver change needed.
- Translation pipeline: `scripts/translate-prep.ts` (reads `data/products.json` → batched `{id, field, source}`) → **Claude translates** → `scripts/translate-results/{locale}.json` (`{id, field, translated}`) → `scripts/translate-apply.ts` → `data/translations/{locale}.json` (`{ "<id>": { description, specification } }`).

## Confirmed decisions
- **Translated product fields: `description` + `specification`** only (matches the existing ru pipeline). `indication`/`packaging`/`protocol` fall back to English for fr/es.
- **No admin translation inputs** — ru has none (translations are static repo JSON). The brief's "admin fr/es input boxes" is dropped to match reality.
- Build order: **②0 → ②a → ②b**.
- French: formal **vous**. Spanish: neutral international, formal **usted**. Do NOT translate brand/product names, INCI/active names (PDRN, PLLA, PCL, hyaluronic acid, exosome…), dosages/volumes/units, SKU codes. Premium B2B tone. Preserve formatting/HTML/`{placeholders}`.

## Parts

### ②0 — Refresh `data/products.json` from the live store
The translation source must be current (477, latest content), not the stale 473 snapshot.
- New `scripts/refresh-products-json.ts`: calls `loadProducts()` (live store) and writes `data/products.json` with the same shape (`{ categories, products }`). Run locally (needs the Supabase env the app already uses), review the diff (count → ~477), commit.
- This is also generally useful hygiene (keeps the committed snapshot honest).

### ②a — Locale plumbing + UI message files
- `lib/i18n.ts`: add `'fr'`, `'es'` to the `locales` tuple (drives next-intl config, `localePath`, and message loading). Keep `localePrefix: 'as-needed'` (en root; ru/fr/es prefixed).
- Confirm the **middleware** (locale + the Korea `KR` geo-block) and the `/en/* → /* 301 redirect` still compose correctly with two more prefixes (matcher generalizes; verify order).
- **Language switcher**: add **Français 🇫🇷** and **Español 🇪🇸** (native names) — locate the component listing EN/RU and extend it.
- **UI messages**: create `messages/fr.json` and `messages/es.json` by AI-translating `messages/en.json` (~700 keys) — mirror the key structure and every `{placeholder}`/ICU plural. Do via batched Claude translation (subagents over key groups), reassembled into one valid JSON each.
- **SEO**: `hreflang` alternates for en/ru/fr/es, `<html lang>` per locale, and include fr/es in the sitemap (locate the existing sitemap/metadata; extend).
- After ②a the site serves `/fr` and `/es` with translated UI chrome and **English product text** (fallback) until ②b lands.

### ②b — Product content translation (the large, batched part)
- Run `npm run translate-prep` (or the script) against the **refreshed** `data/products.json` to emit source batches for **fr** and **es** (each product's `description` + `specification`).
- **Translate each batch with Claude subagents** (fan-out; one subagent per batch), honoring the translation rules above, producing `scripts/translate-results/fr.json` and `es.json` (`{id, field, translated}`).
- Run `translate-apply` → `data/translations/fr.json`, `data/translations/es.json`.
- Verify counts/coverage; spot-check several products in `/fr` and `/es`.
- **Scale note:** ~477 products × 2 fields × 2 locales ≈ ~1,900 strings. This runs in many batches and is the bulk of ②. It likely gets **its own implementation plan** separate from ②0+②a.

## Non-goals
- No runtime translation API. No admin-editable translations. No translation of `indication`/`packaging`/`protocol` for fr/es (English fallback). Russian untouched. Topping up ru's missing ~12% is out of scope.

## Verification
- `tsc --noEmit` + `next build` pass. `/fr` and `/es` render home/catalogue/product/checkout with translated UI; empty product fields fall back to English. hreflang + `<html lang>` correct; sitemap includes fr/es. Switcher shows all four languages. Refreshed `data/products.json` count ≈ 477.

## Open items (resolve during implementation)
- Exact language-switcher component path and the sitemap/metadata location (locate by reading the codebase).
- Whether `loadProducts()` runs cleanly from a standalone `tsx` script with local env (confirm; it's `server-only` — the script imports the same modules the app build uses).
