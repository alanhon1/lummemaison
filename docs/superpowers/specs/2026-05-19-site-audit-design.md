# Site Audit + Optimization — Design

Date: 2026-05-19

## Scope

5-15 min health check on the customer-facing surface of the storefront.
**Don't touch** `data/products.json`, product images on disk, or the
prose fields (`description`, `indication`, `protocol`, `packaging`).

## Checks (run in order)

1. `npx tsc --noEmit -p tsconfig.json` — must be 0 errors.
2. `npm run build` — production build must succeed; capture and fix any
   error.
3. `npm run lint` — only fix issues in `app/` and `components/`. Skip
   the legacy scripts under repo root and `scripts/`.
4. Dev-server log tail — look for runtime errors / hydration mismatches
   in the last few requests; fix any.
5. Hardcoded English strings in customer-facing components: grep for
   common English UI words and convert to `t()` where reasonable.
6. Internal `<Link href>` audit: every static href should resolve to a
   real route.
7. Image performance: confirm `next/image` is used in user-facing image
   spots; verify `sizes` is reasonable.
8. Hot-path renders: ProductCard, CatalogueClient, RelatedProducts.
   Confirm useMemo / no unnecessary re-renders.

## Out of scope

- Lighthouse scores, accessibility deep-dive, design tweaks, copy
  rewrites, image source changes, translations of product descriptions.

## Output

- Brief findings + fixes commit
- After user OK → `git push`
