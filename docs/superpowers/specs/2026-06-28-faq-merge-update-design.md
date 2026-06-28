# FAQ Merge Update — Design

**Date:** 2026-06-28
**Sub-project:** lumee3 ④ (FAQ) — content merge, not a rebuild.

## Context
A full FAQ already exists: `app/[locale]/faq/page.tsx` + `components/faq/FaqClient.tsx` (accordion) + `lib/faq-data.ts` (`FAQ_ITEMS`, each `{ id, q:{en,ru}, a:{en,ru} }`), linked in the footer. `lumee3/lumee-faq.md` is a content brief with new topics + policy items. **Decision: merge** — keep the existing 9 items, update the bulk-discount answer, add the genuinely new topics. Single file changes: `lib/faq-data.ts` only.

## Policy decisions (confirmed)
- **Delivery time:** keep the existing general "3–5 business days" (no regional table).
- **Customs hold / seizure:** follow `lumee-faq.md` framing — held parcels wait on the carrier (up to ~2 weeks), customs often requires the recipient to pay duties; the existing one-free-reship-for-first-orders goodwill (item #6) is retained.
- **Damaged box:** photograph box + contents within **48 hours**, email `info@lumeemaison.com`, reviewed case-by-case.
- **Shelf life:** as printed on packaging, shipped with reasonable remaining life; no fixed minimum-life guarantee.

## Changes to `lib/faq-data.ts`
- **Item #8 (bulk discount)** — rewritten to reflect the new $2,500+ automated 15% flow (pay-now vs 15%-off-quote in 1–3 business days; large/custom → email).
- **New items #10–#17** (en + ru):
  10. Parcel held at customs · 11. Import tax/duties (recipient's responsibility) · 12. Tracking says delivered but nothing arrived · 13. Box arrived damaged (48h photo → case-by-case) · 14. No guaranteed delivery date · 15. No medical advice (professional-use) · 16. Don't combine different products · 17. Shelf life / expiry (as printed).
- Total: **17 items**, ids 1–17.

## Scope / non-goals
- en + ru only now; **fr/es deferred to sub-project ②** (the `FaqItem` type carries en/ru; fr/es is added there).
- No page/component/route changes — the existing FAQ page renders `FAQ_ITEMS` and the accordion already works on mobile.

## Verification
- `tsc --noEmit` + `next build` pass; 17 unique ids; FAQ page renders all items (en + ru) in the accordion.
