# Protocol Templates + Phase 1 Verification — Design

Date: 2026-05-19
Owner: alanhon1
Follow-up to: `2026-05-19-jotform-descriptions-design.md`

## Problem

Two follow-ups to the Jotform Phase 1 import:

1. **Phase 1 verification.** The fuzzy matcher in `import-jotform-descriptions.ts`
   paired 68 rich Jotform records with products in `data/products.json`.
   Most matches are correct, but the matcher uses token overlap with
   threshold 2 — it can mis-pair when two product names share generic
   tokens (e.g. "REJUVENATING CREAM" exists for multiple brands). We need
   an automated sanity check that flags suspicious pairings for human
   review without auto-changing anything.

2. **Protocol detail.** Every product in the catalogue exposes a
   `protocol` field on its detail page. The LLM scaffolding that
   generated the original copy produced one-paragraph generic
   "for professional use only, follow manufacturer instructions"
   boilerplate. The user wants clinical-grade specific protocols —
   reconstitution, injection depth, needle gauge, treatment cadence,
   contraindications — without spending tokens on per-product web
   research. Category templates are the right tool: each of the 20
   categories has a well-defined clinical workflow, and per-product
   variation can be inserted via spec-derived substitutions.

## Source of truth

- For verification: the product's own `name` (canonical, after the
  earlier repair passes).
- For templates: clinical standards expressible as text. No external
  source needed.

## Non-goals

- No web research. (Out of scope per the user's explicit decision to
  skip a full Phase 2 web-research sweep.)
- No `description` / `indication` / `packaging` changes beyond what
  Phase 1 already did. Only `protocol` is rewritten.
- No schema change.
- No translation (`data/translations/`) update.

## Design

### A. `scripts/verify-jotform-matches.ts`

Read-only diagnostic. Idempotent. Does not mutate `data/products.json`.

Steps:

1. Load `data/products.json`.
2. For every product whose `description` field looks like Jotform-sourced
   prose (heuristic: length ≥ 100 chars AND the description does not
   start with the LLM stub phrase `"is a professional-use product"`),
   run the verification rules below.
3. Verification rules — emit one warning per product per failed rule:
   - **Brand-name absence.** Extract the brand prefix from `product.name`
     using `extractBrandPrefix` (already in `scripts/lib/fuzzy-match.ts`).
     If non-null, the brand string (case-insensitive) must appear in the
     `description` OR `indication` field. If not, flag as
     `missing-brand`.
   - **Description too short.** If `description.length < 50`, flag as
     `description-too-short`.
   - **Cross-brand contamination.** A short hard-coded list of known
     competitor brands (`SOSUM`, `JUVIDERM`, `RESTYLANE`, `BOTOX`,
     `BOTULAX`, `REGENOVUE`, `NEURAMIS`, `REVOLAX`, `ELASTY`) — if the
     description contains a competitor brand that is NOT this product's
     own brand, flag as `cross-brand`.
4. Write `scripts/verify-jotform-matches-report.txt` with sections per
   warning kind. Each row: `#id  name  --  description preview (60 chars)`.
5. Print the warning count to stdout. Exit 0 always; this is advisory,
   not gating.

The user reviews the report and decides which entries (if any) to
correct manually.

### B. `scripts/apply-protocol-templates.ts`

Rewrites the `protocol` field of every product in
`data/products.json`. Idempotent: re-running over already-applied data
is a no-op aside from the timestamped backup.

#### B1. Templates

Each of the 20 categories gets a clinical-grade protocol template,
6-12 lines per category. Templates use `{{spec}}`, `{{packaging}}`,
`{{name}}` substitution placeholders that are replaced with the
product's own field values.

The templates live in a single `const PROTOCOL_TEMPLATES: Record<categoryId, string>`
inside the script. Below are the canonical drafts — implementation may
tighten wording but the clinical content is fixed.

- **fillers**:
  Restricted to licensed practitioners trained in injectable
  techniques. Pre-treatment: review medical history (allergies,
  bleeding disorders, recent procedures), photograph the area, mark
  injection points. Disinfect with chlorhexidine 2% or equivalent.
  Use a 27-30G needle (or the cannula supplied with the kit). Inject
  at the target dermal depth (papillary / reticular / sub-dermal per
  product specification — {{spec}}); aspirate before each bolus to
  rule out intravascular placement. Distribute with gentle massage.
  Post-procedure: cold compress, avoid heat / exercise / alcohol for
  24 hours, no makeup for 12 hours. Follow-up at 2 weeks; touch-up
  injection if needed.

- **mesotherapy**:
  Cleanse and disinfect the treatment area; topical anesthetic
  optional. Use a 30-32G needle, derma-stamp, or 0.25-0.5 mm
  derma-roller. Mesotherapy depth is 1-4 mm intradermal. Standard
  pattern: papules 1 cm apart, approximately 0.05-0.1 mL per point.
  Per session volume is dictated by the product packaging ({{spec}}).
  Treatment cycle: weekly for 4-8 sessions, then monthly maintenance.
  Post-procedure: avoid sun exposure, makeup, swimming, and saunas
  for 24 hours.

- **acne-treatment**:
  Apply to clean, dry skin once or twice daily as directed. Spot or
  full-area application per indication. For prescription-strength
  formulations, start with every-other-day application and increase
  to nightly as tolerated. Discontinue if severe irritation occurs.
  Use broad-spectrum SPF 30+ during the day; many active ingredients
  increase photosensitivity. Reassess at 4-6 weeks; combine with
  professional treatments (peels, light therapy) per clinical
  protocol.

- **hair-treatment**:
  For topical formulations: apply to clean, dry scalp twice daily,
  massage in gently, leave on. Avoid washing for at least 4 hours.
  For injectable hair-loss therapy ({{spec}}): scalp mesotherapy
  injections at affected zones using a 30G needle or roller, depth
  2-3 mm, 0.05 mL per point, 1 cm grid. Treatment cycle: weekly for
  4-6 sessions, then monthly maintenance. Visible regrowth typically
  observed after 3 months of consistent use.

- **pharmacy-favourites**:
  Use per product label and prescriber direction. For topical
  formulations: apply a thin layer to clean, dry skin in the
  affected area, frequency as directed (typically 1-2 times daily).
  For oral or systemic preparations: follow dosing per package
  insert. Store as labeled; observe expiration dates. Discontinue
  and seek clinical advice if irritation, allergy, or unexpected
  reaction occurs.

- **topical-cosmetics**:
  Apply to clean, dry skin morning and / or evening per the product
  type. Layer order: cleanser → toner → serum → cream → sunscreen
  (AM). Use the dispensing amount indicated by the packaging
  ({{spec}}). Patch-test on the inner forearm 24 hours before first
  full-face use. Discontinue if irritation occurs. Pair AM
  applications with broad-spectrum SPF 30+ sunscreen.

- **intimate-care**:
  Intended for external V-zone application. Cleanse the area, dry,
  and apply a small amount to the affected zone. Frequency:
  typically 1-2 times daily or per applicator-pack guidance
  ({{spec}}). Avoid mucosal surfaces unless the product is labeled
  for internal use. Discontinue if irritation or discomfort
  develops. Pair with appropriate intimate hygiene routine.

- **growth-factor-exosome**:
  Reconstitute the lyophilized powder with the supplied diluent;
  swirl gently — do not shake. Use the reconstituted solution
  within the manufacturer's stability window. Application options:
  (1) topical microneedling: roll or stamp at 0.25-1.0 mm depth,
  then apply the solution to the treated skin; (2) injection
  mesotherapy: 30G needle, papules 1 cm apart, 0.05 mL per point,
  intradermal depth. Cycle: 3-6 sessions at 2-4 week intervals.

- **curenex**:
  Use as part of the Curenex daily-care or in-clinic routine per
  the specific product type ({{name}}). Cleansers / toners / masks
  follow standard skincare layering. For Curenex injectable
  preparations: reconstitute and inject intradermally with a 30G
  needle, depth 1-2 mm, papules 1 cm apart, per the supplied
  packaging ({{spec}}). Treatment cycle: 3-4 sessions at 2 week
  intervals, then monthly maintenance.

- **dermagen**:
  Topical formulations: apply a thin layer to clean, dry skin in
  the targeted area, frequency as directed on the carton
  (typically 1-2 times daily). For prescription-strength
  Dermagen products, start with every-other-day application.
  Discontinue if severe irritation occurs and consult a
  professional. Pair daytime application with broad-spectrum SPF
  30+ sunscreen.

- **gtm**:
  Apply per GTM product type ({{name}}). For pre-mixed serums and
  creams: thin layer to clean, dry skin, 1-2 times daily. For
  in-clinic peel preparations: brush evenly onto the treatment
  area, neutralize per the manufacturer's protocol after the
  prescribed exposure time, rinse thoroughly. Avoid sun exposure
  and apply broad-spectrum SPF 30+ during recovery.

- **equipment**:
  Reserved for trained operators. Read the manufacturer manual
  before first use. Inspect the device for damage, calibrate per
  manual, ensure all consumables (gels, electrodes, tips) are
  current. Configure parameters (energy / depth / frequency) per
  the treatment indication and patient skin type. Treat in
  controlled, evenly distributed passes; monitor patient
  feedback. Post-procedure: cooling, hydration, and SPF 30+ during
  recovery.

- **salon-grade**:
  Professional spa or salon use. Apply per product type ({{name}}):
  cleansers and lotions follow standard pre-treatment cleansing;
  modeling and massage products are applied to the prepared
  treatment area per the manufacturer-recommended technique and
  exposure time. Rinse or remove thoroughly per protocol.

- **lipolytics**:
  Restricted to licensed practitioners. Pre-treatment: medical
  history review, target-area markup, sterile preparation. Use a
  27-30G needle. Inject subcutaneously into the fat compartment at
  the marked grid points, depth 6-13 mm depending on tissue
  thickness, 0.1-0.4 mL per point per the product strength
  ({{spec}}). Treatment cycle: 2-6 sessions at 4-6 week intervals.
  Post-procedure: compression garment if applicable, expect mild
  swelling and tenderness for 3-7 days.

- **botulinum**:
  Reconstitute the lyophilized powder with 0.9% saline per the
  manufacturer's dilution table ({{spec}}). Use a 30-32G needle.
  Inject 0.1 mL per point at marked muscle landmarks; typical
  glabellar pattern is 5 points (corrugator + procerus). Onset 3-7
  days, peak effect at 2 weeks. Re-treatment interval 3-4 months.
  Contraindications: pregnancy, lactation, neuromuscular disease,
  active infection at the injection site. Post-injection: no
  rubbing or bending forward for 4 hours.

- **injections**:
  Restricted to licensed practitioners. Reconstitute (if
  applicable) per the package insert. Use a 27-30G needle.
  Administration route is per product class ({{spec}}):
  intramuscular, intravenous slow-push, or subcutaneous. Aspirate
  before injection. Monitor the patient through the procedure;
  observe for the first 15-30 minutes for hypersensitivity.
  Treatment cycle is product-specific — follow the package insert.

- **anesthetics**:
  Topical surface anesthetic. Apply a thick layer to clean, dry
  skin over the procedure area, cover with occlusive film, leave
  on for 20-60 minutes per concentration ({{spec}}). Remove film,
  wipe excess cream, then commence the planned procedure
  immediately. Do not exceed the maximum recommended application
  area or duration to avoid systemic absorption. Discontinue if
  irritation develops.

- **placental-therapy**:
  Restricted to licensed practitioners. Reconstitute as supplied
  ({{spec}}). Administration: intramuscular (gluteal or deltoid)
  or subcutaneous mesotherapy per the product label. Standard
  course: 2-3 ampoules per week for 4-8 weeks, then monthly
  maintenance. Monitor for hypersensitivity during the first 15
  minutes post-injection. Contraindications: known allergy to
  placental proteins, pregnancy, autoimmune disease.

- **nano-needle-cannula**:
  Sterile single-patient use. Inspect packaging for integrity
  before opening. Attach to a Luer-lock syringe; prime with the
  selected injectable. Insert at the planned entry point at the
  intended depth (typically 1-4 mm for mesotherapy needles, 5-13
  mm for cannulas). Deliver the product slowly to minimize tissue
  trauma. Withdraw, apply pressure briefly, dispose in a sharps
  container.

- **imported-products**:
  Restricted to licensed practitioners. Follow the manufacturer's
  label, prescriber direction, and applicable local regulations
  for the specific imported brand ({{name}}). Reconstitution,
  needle gauge, injection depth, and treatment cycle are
  product-specific — refer to the official insert supplied with
  the carton. Confirm cold-chain integrity before use; do not use
  if the product is past its expiration date or shows particulate
  contamination.

#### B2. Substitution

Before writing the protocol to a product, run:

```ts
text.replace(/\{\{spec\}\}/g, product.specification || '—')
    .replace(/\{\{packaging\}\}/g, product.packaging || '—')
    .replace(/\{\{name\}\}/g, product.name);
```

A missing field substitutes to an em-dash so the prose never reads
"undefined".

#### B3. Skip rule

Products with a Phase 1 Jotform protocol — those whose current
`protocol` field is non-empty AND does NOT match the LLM stub regex
`/^(Intended for professional|Reserved for|Professional-use product|For professional use only)/` —
are SKIPPED. This protects the small set of products with real
Jotform-derived protocols.

#### B4. Report

`scripts/apply-protocol-templates-report.txt`:

- Applied (count + per-product `#id name (category)`)
- Skipped — already has Jotform protocol (count + per-product)
- Categories with zero products (sanity)
- Substitutions where `{{spec}}` resolved to em-dash

## Verification

Script-side:
- `node scripts/verify-jotform-matches.ts` exits 0; report file has
  ≤ ~15 warnings total (very loose — false positives are fine).
- `apply-protocol-templates.ts` exits 0; report shows
  `applied ~411 skipped ~10`.
- Re-running `apply-protocol-templates.ts` on clean data is a no-op
  (`applied 0`).

Manual:
- Open `/en/product/1` (BARBIE SLIM) — protocol shows the lipolytics
  template with `{{spec}}` substituted to "10 mL x 5 vials".
- Open `/en/product/110` (JUVELOOK i) — protocol shows the Jotform
  prose ("2-3 sessions, every 4-6 weeks…"), NOT the mesotherapy
  template. This is the skip rule working.
- Open `/en/product/320` (BOTULAX 100 units) — protocol shows the
  botulinum template with reconstitution language and the 30-32G
  needle guidance.

## Rollback

`copy data\backups\products-{timestamp}.json data\products.json`

## Out of scope (follow-ups)

- True per-product web research for the Phase 2 candidates list. The
  user has deferred this indefinitely.
- Translating the new protocol prose for `data/translations/ru.json`
  and `ko.json`.
- Customising the template per sub-brand (e.g. different protocol for
  REGENOVUE vs JUVELOOK fillers). Current templates are
  category-level uniform.
