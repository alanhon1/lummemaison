# French + Spanish Locales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/fr` and `/es` locales (UI + product content) the way `/ru` is done, after refreshing the committed catalogue snapshot from the live store.

**Architecture:** ②0 refresh `data/products.json` from the Supabase-Storage live store; ②a add `fr`/`es` to the locale list + switcher + SEO + translated UI message files; ②b batch-translate each product's `description`+`specification` to fr/es with Claude and emit `data/translations/{fr,es}.json` (the existing resolver already overlays these with English fallback).

**Tech Stack:** Next.js 16 (App Router, Turbopack), next-intl, Supabase Storage, TypeScript, `tsx` scripts.

## Global Constraints

- Locales become `['en','ru','fr','es']`; `localePrefix: 'as-needed'` (en at root; ru/fr/es prefixed). `localePath` already generalizes — do not special-case fr/es.
- **Russian is untouched.** Do not modify `data/translations/ru.json`, `*_ru` fields, or ru UI.
- Translated product fields: **`description` + `specification` only**. `indication`/`packaging`/`protocol` fall back to English for fr/es.
- Translation is produced by **Claude** (this session's subagents), never a runtime/Google API.
- Translation rules (apply to BOTH UI strings and product content): **French = formal "vous"; Spanish = neutral international, formal "usted".** Premium B2B tone. **Do NOT translate:** brand/product/manufacturer names ("Lumée Maison", "Korestetics Global", product titles), INCI/active names & abbreviations (PDRN, PLLA, PCL, polynucleotide, hyaluronic acid, exosome, etc.), dosages/volumes/units/concentrations, model/SKU codes. Preserve formatting, HTML tags, punctuation, and every `{placeholder}` / ICU plural.
- No admin-editable translations (matches ru). No `description_fr`/`_es` product fields — fr/es use `data/translations/{locale}.json` only.
- Money/unused. After every task: `npx tsc --noEmit` passes before commit; the UI/product builds also pass `npx next build`. No formal test framework — pure scripts are checked by running them; translations by `tsc`/`next build` + spot-checks.

---

## File Structure

**New**
- `scripts/refresh-products-json.ts` — pull the live store → `data/products.json`.
- `messages/fr.json`, `messages/es.json` — UI translations.
- `app/sitemap.ts` — multi-locale sitemap (none exists today).
- `data/translations/fr.json`, `data/translations/es.json` — product content translations (emitted by the pipeline).
- `scripts/translate-batches/{fr,es}/batch-*.json`, `scripts/translate-results/{fr,es}.json` — pipeline scratch/output.

**Edit**
- `data/products.json` — refreshed snapshot (②0).
- `lib/i18n.ts` — add `'fr','es'` to `locales`.
- `components/layout/Header.tsx` — add Français/Español to the language switcher.
- `app/layout.tsx` and/or `app/[locale]/layout.tsx` — `hreflang` alternates + `<html lang>` per locale.
- `scripts/translate-prep.ts`, `scripts/translate-apply.ts` — add `fr,es` to their `LOCALES`.

---

## Phase ②0 — Refresh the catalogue snapshot

### Task 1: `scripts/refresh-products-json.ts`

**Files:**
- Create: `scripts/refresh-products-json.ts`
- Modify (output): `data/products.json`

**Interfaces:** none code-facing; produces a refreshed `data/products.json` (`{ categories, products }`).

- [ ] **Step 1: Write the script.** The live catalogue is a Supabase Storage object (bucket `catalogue`, object `products.json`) — see `lib/catalogue-store.ts`. Replicate its download directly (that module is `server-only`, so do NOT import it). Mirror how an existing Supabase script loads env + builds the service client — read `scripts/ensure-payment-proofs-bucket.ts` and copy its env-loading + `createServiceClient` usage.

```ts
// scripts/refresh-products-json.ts — run: npx tsx scripts/refresh-products-json.ts
// (mirror the dotenv/env-loading prelude from scripts/ensure-payment-proofs-bucket.ts)
import fs from 'node:fs';
import path from 'node:path';
import { createServiceClient } from '@/lib/supabase/server';

const OUT = path.join(process.cwd(), 'data', 'products.json');

async function main() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from('catalogue').download('products.json');
  if (error || !data) throw new Error(`live store download failed: ${error?.message ?? 'no data'}`);
  const parsed = JSON.parse(await data.text());
  const liveProducts = Array.isArray(parsed) ? parsed : parsed.products;
  if (!Array.isArray(liveProducts)) throw new Error('unexpected live-store shape');

  // Categories are NOT stored in the live store (they stay bundled) — keep the
  // existing data/products.json categories, swap in the live products.
  const current = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const next = { categories: current.categories, products: liveProducts };
  fs.writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log(`✓ refreshed data/products.json: ${current.products.length} → ${liveProducts.length} products`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

> If `@/` path aliases don't resolve under `tsx`, mirror exactly how the existing `scripts/*.ts` import from `@/lib/...` (they run under the same tsx config) — do not invent a different import style.

- [ ] **Step 2: Run it.** Run: `npx tsx scripts/refresh-products-json.ts` → Expected: `✓ refreshed data/products.json: 473 → <N> products` where N ≈ 477.
- [ ] **Step 3: Sanity-check the diff.** Run: `git diff --stat data/products.json` → product count went up by a few; structure still `{ categories, products }`. Confirm `node -e "console.log(require('./data/products.json').products.length)"` prints ≈477.
- [ ] **Step 4: Typecheck + commit.** `npx tsc --noEmit` → no errors.

```bash
git add scripts/refresh-products-json.ts data/products.json
git commit -m "chore(catalogue): refresh data/products.json from the live store"
```

---

## Phase ②a — Locale plumbing + UI

### Task 2: Add `fr` + `es` to the locale list

**Files:**
- Modify: `lib/i18n.ts:1`

**Interfaces:** Produces the widened `locales` tuple consumed by next-intl config, `localePath`, and message loading.

- [ ] **Step 1: Edit.** Change line 1 of `lib/i18n.ts`:

```ts
export const locales = ['en', 'ru', 'fr', 'es'] as const;
```

(Everything else in `lib/i18n.ts` already generalizes.)

- [ ] **Step 2: Check the middleware composes.** Read the project middleware (locale handling + the Korea `KR` geo-block) and confirm adding two prefixes doesn't break its matcher or the `/en/* → /* 301 redirect`. The next-intl middleware derives prefixes from `locales`, so no per-locale code is expected — but verify the geo-block runs in the same order and its matcher still excludes `/manzura`/`/api/admin`.
- [ ] **Step 3: Build.** `npx tsc --noEmit` then `npx next build`. Until `messages/fr.json`/`es.json` exist (Task 4), `next build` may fail to resolve those locales' messages — if so, do Task 4 first and run the build there. (Reorder Task 2↔4 if the build needs the message files present; both must be green before committing.)
- [ ] **Step 4: Commit** (after Task 4 if the build needs the files):

```bash
git add lib/i18n.ts
git commit -m "feat(i18n): register fr + es locales"
```

### Task 3: Language switcher — add Français + Español

**Files:**
- Modify: `components/layout/Header.tsx`

**Interfaces:** none.

- [ ] **Step 1: Locate + extend.** In `components/layout/Header.tsx`, find the language-switcher list (it currently offers EN / Русский). Add **Français** and **Español** using the same pattern (native names; keep any flag/label convention the existing entries use). Each entry links to the same path under its locale via `localePath(locale, currentPath)` (or the existing mechanism). Mirror the existing entries exactly — do not restructure the switcher.
- [ ] **Step 2: Verify.** `npx tsc --noEmit` → no errors. (Visual check happens in Task 9.)
- [ ] **Step 3: Commit.**

```bash
git add components/layout/Header.tsx
git commit -m "feat(i18n): add Français + Español to the language switcher"
```

### Task 4: UI message files `messages/fr.json` + `messages/es.json`

**Files:**
- Create: `messages/fr.json`, `messages/es.json`

**Interfaces:** Produces fr/es message catalogs mirroring `messages/en.json` key-for-key.

This is a **Claude translation task**, not mechanical. `messages/en.json` is the source of truth (~700 keys).

- [ ] **Step 1: Translate `en.json` → `fr.json`.** Produce `messages/fr.json` with the **identical key structure** as `messages/en.json`, every value translated to French per the Global-Constraints translation rules (formal "vous"; preserve every `{placeholder}` and ICU plural form exactly; don't translate brand/INCI/SKU). For a file this size, fan out: split `en.json`'s top-level namespaces across subagents, each returning a valid JSON fragment for its namespaces, then assemble into one valid `messages/fr.json`. Validate: `node -e "JSON.parse(require('fs').readFileSync('messages/fr.json','utf8'))"` (no throw) and key-parity check below.
- [ ] **Step 2: Translate `en.json` → `es.json`.** Same, in neutral international Spanish (formal "usted").
- [ ] **Step 3: Key-parity check.** Run:

```bash
node -e "const e=require('./messages/en.json'),f=require('./messages/fr.json'),s=require('./messages/es.json');const keys=o=>{const out=[];(function w(p,x){for(const k in x){const np=p?p+'.'+k:k;typeof x[k]==='object'&&x[k]?w(np,x[k]):out.push(np)}})('',o);return out.sort()};const ek=JSON.stringify(keys(e));console.log('fr parity:',ek===JSON.stringify(keys(f)));console.log('es parity:',ek===JSON.stringify(keys(s)));"
```

Expected: `fr parity: true` and `es parity: true`. Fix any missing/extra keys.

- [ ] **Step 4: Build.** `npx tsc --noEmit` then `npx next build` (both pass — this also validates Task 2's locale registration end-to-end).
- [ ] **Step 5: Commit.**

```bash
git add messages/fr.json messages/es.json lib/i18n.ts
git commit -m "feat(i18n): French + Spanish UI message catalogs"
```

### Task 5: SEO — multi-locale sitemap + hreflang + html lang

**Files:**
- Create: `app/sitemap.ts`
- Modify: `app/[locale]/layout.tsx` (hreflang alternates + `<html lang>`)

**Interfaces:** none.

- [ ] **Step 1: `<html lang>` + hreflang.** In the locale layout (`app/[locale]/layout.tsx`), set `<html lang={locale}>` (if the root `app/layout.tsx` owns `<html>`, pass the locale down or set `lang` in the locale layout's metadata). Add `alternates.languages` to the locale metadata mapping each of en/ru/fr/es to its `localePath`-built URL (absolute, using the existing `metadataBase`).

```ts
// in generateMetadata for app/[locale]/layout.tsx (merge with existing):
import { locales } from '@/lib/i18n';
import { localePath } from '@/lib/i18n';
// languages: { en: '/', ru: '/ru', fr: '/fr', es: '/es' } built via localePath(l, '/')
alternates: {
  languages: Object.fromEntries(locales.map(l => [l, localePath(l, '/')])),
},
```

- [ ] **Step 2: Sitemap.** Create `app/sitemap.ts` returning the main routes for every locale (use `localePath` + `metadataBase`). Include `/`, `/catalogue`, `/about`, `/contact`, `/faq` per locale at minimum.

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { locales, localePath } from '@/lib/i18n';

const BASE = 'https://lumeemaison.com';
const ROUTES = ['/', '/catalogue', '/about', '/contact', '/faq'];

export default function sitemap(): MetadataRoute.Sitemap {
  return locales.flatMap(l => ROUTES.map(r => ({ url: BASE + localePath(l, r), changeFrequency: 'weekly' as const })));
}
```

- [ ] **Step 3: Build.** `npx tsc --noEmit` then `npx next build` (succeeds; `/sitemap.xml` route present).
- [ ] **Step 4: Commit.**

```bash
git add app/sitemap.ts "app/[locale]/layout.tsx"
git commit -m "feat(seo): hreflang alternates + multi-locale sitemap for en/ru/fr/es"
```

---

## Phase ②b — Product content translation (batched)

### Task 6: Point the pipeline at fr + es and emit source batches

**Files:**
- Modify: `scripts/translate-prep.ts:13`, `scripts/translate-apply.ts:13`

**Interfaces:** Produces `scripts/translate-batches/{fr,es}/batch-*.json` (`{id, field, source}`, 25/batch) from the refreshed `data/products.json`.

- [ ] **Step 1: Add fr/es to the pipeline locale lists.** In BOTH `scripts/translate-prep.ts` (line 13) and `scripts/translate-apply.ts` (line 13), change `const LOCALES = ['ru', 'ko'] as const;` to include fr/es **without disturbing ru** (it regenerates ru batches harmlessly but you will NOT re-translate or re-apply ru). For a clean, ru-safe run, set it to `['fr', 'es'] as const;` in both scripts for this work (revert-free: these are scratch scripts; or keep ru/ko and just ignore their outputs). Use `['fr', 'es']`.
- [ ] **Step 2: Generate batches.** Run: `npx tsx scripts/translate-prep.ts` → Expected: `Locale fr: wrote <B> batches (<T> tuples) …` and the same for es, where T ≈ 2×(products with text) ≈ ~900 and B ≈ ceil(T/25) ≈ ~38. Confirm `scripts/translate-batches/fr/` and `/es/` contain the batch files.
- [ ] **Step 3: Commit the script change** (batches are scratch — add to .gitignore or leave untracked):

```bash
git add scripts/translate-prep.ts scripts/translate-apply.ts
git commit -m "chore(i18n): point translate pipeline at fr + es"
```

### Task 7: Translate the batches with Claude (fan-out)

**Files:**
- Create: `scripts/translate-results/fr.json`, `scripts/translate-results/es.json`

**Interfaces:** Consumes the batch files (Task 6). Produces, per locale, a single flat array of `{ id, field, translated }` covering every input tuple.

> This is the bulk of ②b — ~38 batches × 2 locales. Execute as a **subagent fan-out**: one subagent per batch file. Each subagent reads its `batch-N.json`, translates each tuple's `source` per the Global-Constraints translation rules, and returns the same array with `translated` added (no other text). The controller concatenates all of a locale's batch results into `scripts/translate-results/<locale>.json`.

- [ ] **Step 1: Translate all `fr` batches.** For each `scripts/translate-batches/fr/batch-N.json`, dispatch a translator subagent with the translation rules + the batch contents; collect `{id, field, translated}` for every tuple. Concatenate into `scripts/translate-results/fr.json` (flat array).
- [ ] **Step 2: Translate all `es` batches.** Same for `scripts/translate-batches/es/`.
- [ ] **Step 3: Coverage check.** Run: `node -e "const b=require('glob');" ` is not available — instead verify each results file's length equals the total input tuples: compare `cat scripts/translate-batches/fr/*.json` tuple count to `scripts/translate-results/fr.json` length. Every `(id, field)` in the batches must appear once in the results, each with a non-empty `translated`.
- [ ] **Step 4: Commit.**

```bash
git add scripts/translate-results/fr.json scripts/translate-results/es.json
git commit -m "feat(i18n): French + Spanish product translations (raw results)"
```

### Task 8: Apply → `data/translations/{fr,es}.json`

**Files:**
- Create: `data/translations/fr.json`, `data/translations/es.json`

**Interfaces:** Consumes `scripts/translate-results/{fr,es}.json`. Produces id-keyed `{ "<id>": { description, specification } }` read by `lib/products.ts`.

- [ ] **Step 1: Apply.** Run: `npx tsx scripts/translate-apply.ts` → Expected: it reshapes the results into `data/translations/fr.json` and `data/translations/es.json`. Confirm `node -e "console.log(Object.keys(require('./data/translations/fr.json')).length)"` ≈ number of products with text.
- [ ] **Step 2: Build + spot-check.** `npx tsc --noEmit` then `npx next build`. The resolver `lib/products.ts` `localized()` already overlays `data/translations/{locale}.json` for fr/es with English fallback — no code change. Spot-check 3–5 products at `/fr/product/<id>` and `/es/product/<id>` show translated description/specification; untranslated ones fall back to English.
- [ ] **Step 3: Commit.**

```bash
git add data/translations/fr.json data/translations/es.json
git commit -m "feat(i18n): apply French + Spanish product translations"
```

---

## Phase — Verification

### Task 9: End-to-end verification

**Files:** none.

- [ ] **Step 1: Static.** `npx tsc --noEmit` + `npx next build` pass.
- [ ] **Step 2: Locale rendering.** `/fr` and `/es` render home, `/catalogue`, a `/product/[id]`, and `/checkout` with translated UI chrome. Russian and English unchanged.
- [ ] **Step 3: Fallback.** A product without a fr/es translation shows English description/specification (no blank, no key leak).
- [ ] **Step 4: Switcher + SEO.** The language switcher lists EN / Русский / Français / Español and each links to the same page under its prefix. `<html lang>` matches the locale; `/sitemap.xml` includes fr/es URLs; hreflang alternates present in page head.
- [ ] **Step 5: Key parity.** Re-run the Task 4 Step 3 parity check → `true`/`true`.
- [ ] **Step 6: Counts.** `data/products.json` ≈ 477; `data/translations/fr.json` and `es.json` cover the products with text.

---

## Notes / sequencing
- **②0 (Task 1) first** — the translation source must be current. It needs the Supabase service env locally (the app already uses it).
- Tasks 2 and 4 are interdependent for `next build` (locale registration needs the message files). Do them together; commit once both build green.
- **②b (Tasks 6–8) is the bulk** and runs as a subagent fan-out (~76 batch translations). It can be split into its own execution session if needed; ②0+②a deliver a working fr/es site (English product text) on their own.
- Do NOT touch ru anywhere. Keep `scripts/translate-batches/` and `scripts/translate-results/` out of git history bloat if large (they're scratch — gitignore acceptable; results are committed only because they're the source of the applied `data/translations`).
