# Protocol Templates + Phase 1 Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only verification script for Phase 1 Jotform pairings, and rewrite `protocol` for every product with category-specific clinical templates that substitute the product's own spec.

**Architecture:** Two standalone Node scripts (`verify-jotform-matches.ts`, `apply-protocol-templates.ts`). Both idempotent. One npm alias each.

**Tech Stack:** TypeScript via `tsx`. Reuses `scripts/lib/fuzzy-match.ts` for the brand-prefix extractor.

**Spec:** `docs/superpowers/specs/2026-05-19-protocol-templates-design.md`

---

## File Structure

**New files:**
- `scripts/verify-jotform-matches.ts` — diagnostic only.
- `scripts/apply-protocol-templates.ts` — rewrites `protocol`.
- `scripts/verify-jotform-matches-report.txt` — generated.
- `scripts/apply-protocol-templates-report.txt` — generated.

**Modified files:**
- `package.json` — two new npm aliases.
- `data/products.json` — protocol field rewritten.
- `data/backups/products-{ts}.json` — auto-created by the apply script.

---

## Task 1: npm aliases

**Files:** `package.json`

- [ ] **Step 1**: Open `package.json`. In `scripts`, after `"import-jotform-descriptions"` add:

```json
    "verify-jotform-matches": "tsx scripts/verify-jotform-matches.ts",
    "apply-protocol-templates": "tsx scripts/apply-protocol-templates.ts",
```

- [ ] **Step 2**: Verify JSON valid:

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
```

Expected: no output.

- [ ] **Step 3**: Commit:

```bash
git add package.json
git commit -m "chore(scripts): add verify-jotform-matches + apply-protocol-templates aliases"
```

---

## Task 2: `scripts/verify-jotform-matches.ts`

**Files:** Create `scripts/verify-jotform-matches.ts`

- [ ] **Step 1**: Write the complete script:

```ts
/**
 * Read-only verification of Phase 1 Jotform pairings.
 * Flags products with Jotform-sourced description prose that look
 * suspicious. Does not mutate data/products.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractBrandPrefix } from './lib/fuzzy-match';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const REPORT_PATH = path.join(ROOT, 'scripts', 'verify-jotform-matches-report.txt');

interface Product {
  id: number;
  name: string;
  description: string;
  indication?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

const KNOWN_BRANDS = ['SOSUM', 'JUVIDERM', 'RESTYLANE', 'BOTOX', 'BOTULAX', 'REGENOVUE', 'NEURAMIS', 'REVOLAX', 'ELASTY'];

interface Warning { kind: string; id: number; name: string; preview: string }

function isJotformProse(p: Product): boolean {
  const d = p.description || '';
  if (d.length < 100) return false;
  if (/\bis a professional-use product\b/i.test(d)) return false;
  return true;
}

function main(): void {
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const warnings: Warning[] = [];

  for (const p of data.products) {
    if (!isJotformProse(p)) continue;
    const desc = p.description || '';
    const ind = (p.indication as string | undefined) || '';
    const preview = desc.slice(0, 60).replace(/\s+/g, ' ');

    // Rule 1: brand-name absence
    const brand = extractBrandPrefix(p.name);
    if (brand) {
      const hay = (desc + ' ' + ind).toLowerCase();
      if (!hay.includes(brand.toLowerCase())) {
        warnings.push({ kind: 'missing-brand', id: p.id, name: p.name, preview });
      }
    }

    // Rule 2: description too short (handled by isJotformProse cutoff at 100 — so this is dead-code-ish unless we tighten)
    if (desc.length < 50) {
      warnings.push({ kind: 'description-too-short', id: p.id, name: p.name, preview });
    }

    // Rule 3: cross-brand contamination
    const ownUpper = p.name.toUpperCase();
    for (const b of KNOWN_BRANDS) {
      if (ownUpper.includes(b)) continue;
      if (desc.toUpperCase().includes(b)) {
        warnings.push({ kind: 'cross-brand', id: p.id, name: p.name, preview: `${preview} [contains "${b}"]` });
      }
    }
  }

  const lines: string[] = [];
  lines.push('# verify-jotform-matches report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`total warnings: ${warnings.length}`);
  lines.push('');

  for (const kind of ['missing-brand', 'description-too-short', 'cross-brand']) {
    const subset = warnings.filter(w => w.kind === kind);
    lines.push(`## ${kind} (${subset.length})`);
    for (const w of subset) {
      lines.push(`  #${w.id}  ${w.name}  --  ${w.preview}`);
    }
    lines.push('');
  }

  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`verify-jotform-matches: ${warnings.length} warnings → ${REPORT_PATH}`);
}

main();
```

- [ ] **Step 2**: Run:

```bash
npx tsx scripts/verify-jotform-matches.ts
```

Expected: `N warnings → ...verify-jotform-matches-report.txt`. N is typically < 20.

- [ ] **Step 3**: Open the report:

```bash
head -40 scripts/verify-jotform-matches-report.txt
```

Quick scan — note any obvious bad pairings to the user later.

- [ ] **Step 4**: Commit:

```bash
git add scripts/verify-jotform-matches.ts scripts/verify-jotform-matches-report.txt
git commit -m "feat(scripts): verify-jotform-matches (read-only diagnostic)"
```

---

## Task 3: `scripts/apply-protocol-templates.ts`

**Files:** Create `scripts/apply-protocol-templates.ts`

- [ ] **Step 1**: Write the complete script (templates inline). This is a single large file; paste exactly:

```ts
/**
 * Rewrite the `protocol` field of every product with category-specific
 * clinical templates. Substitute {{spec}}, {{packaging}}, {{name}}.
 *
 * Skips products whose current protocol does NOT match the LLM stub —
 * those are Phase 1 Jotform-derived and should be preserved.
 *
 * Idempotent: re-running on clean data is a no-op aside from the
 * timestamped backup.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const REPORT_PATH = path.join(ROOT, 'scripts', 'apply-protocol-templates-report.txt');

const STUB_RE = /^(Intended for professional|Reserved for|Professional-use product|For professional use only)/;

interface Product {
  id: number;
  name: string;
  categoryId: string;
  specification: string;
  packaging?: string;
  protocol?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: Array<{ id: string }> }

const TEMPLATES: Record<string, string> = {
  'fillers': `Restricted to licensed practitioners trained in injectable techniques. Pre-treatment: review medical history (allergies, bleeding disorders, recent procedures), photograph the area, mark injection points. Disinfect with chlorhexidine 2% or equivalent. Use a 27-30G needle (or the cannula supplied with the kit). Inject at the target dermal depth (papillary / reticular / sub-dermal per product specification — {{spec}}); aspirate before each bolus to rule out intravascular placement. Distribute with gentle massage. Post-procedure: cold compress, avoid heat / exercise / alcohol for 24 hours, no makeup for 12 hours. Follow-up at 2 weeks; touch-up injection if needed.`,
  'mesotherapy': `Cleanse and disinfect the treatment area; topical anesthetic optional. Use a 30-32G needle, derma-stamp, or 0.25-0.5 mm derma-roller. Mesotherapy depth is 1-4 mm intradermal. Standard pattern: papules 1 cm apart, approximately 0.05-0.1 mL per point. Per session volume is dictated by the product packaging ({{spec}}). Treatment cycle: weekly for 4-8 sessions, then monthly maintenance. Post-procedure: avoid sun exposure, makeup, swimming, and saunas for 24 hours.`,
  'acne-treatment': `Apply to clean, dry skin once or twice daily as directed. Spot or full-area application per indication. For prescription-strength formulations, start with every-other-day application and increase to nightly as tolerated. Discontinue if severe irritation occurs. Use broad-spectrum SPF 30+ during the day; many active ingredients increase photosensitivity. Reassess at 4-6 weeks; combine with professional treatments (peels, light therapy) per clinical protocol.`,
  'hair-treatment': `For topical formulations: apply to clean, dry scalp twice daily, massage in gently, leave on. Avoid washing for at least 4 hours. For injectable hair-loss therapy ({{spec}}): scalp mesotherapy injections at affected zones using a 30G needle or roller, depth 2-3 mm, 0.05 mL per point, 1 cm grid. Treatment cycle: weekly for 4-6 sessions, then monthly maintenance. Visible regrowth typically observed after 3 months of consistent use.`,
  'pharmacy-favourites': `Use per product label and prescriber direction. For topical formulations: apply a thin layer to clean, dry skin in the affected area, frequency as directed (typically 1-2 times daily). For oral or systemic preparations: follow dosing per package insert. Store as labeled; observe expiration dates. Discontinue and seek clinical advice if irritation, allergy, or unexpected reaction occurs.`,
  'topical-cosmetics': `Apply to clean, dry skin morning and / or evening per the product type. Layer order: cleanser → toner → serum → cream → sunscreen (AM). Use the dispensing amount indicated by the packaging ({{spec}}). Patch-test on the inner forearm 24 hours before first full-face use. Discontinue if irritation occurs. Pair AM applications with broad-spectrum SPF 30+ sunscreen.`,
  'intimate-care': `Intended for external V-zone application. Cleanse the area, dry, and apply a small amount to the affected zone. Frequency: typically 1-2 times daily or per applicator-pack guidance ({{spec}}). Avoid mucosal surfaces unless the product is labeled for internal use. Discontinue if irritation or discomfort develops. Pair with appropriate intimate hygiene routine.`,
  'growth-factor-exosome': `Reconstitute the lyophilized powder with the supplied diluent; swirl gently — do not shake. Use the reconstituted solution within the manufacturer's stability window. Application options: (1) topical microneedling: roll or stamp at 0.25-1.0 mm depth, then apply the solution to the treated skin; (2) injection mesotherapy: 30G needle, papules 1 cm apart, 0.05 mL per point, intradermal depth. Cycle: 3-6 sessions at 2-4 week intervals.`,
  'curenex': `Use as part of the Curenex daily-care or in-clinic routine per the specific product type ({{name}}). Cleansers / toners / masks follow standard skincare layering. For Curenex injectable preparations: reconstitute and inject intradermally with a 30G needle, depth 1-2 mm, papules 1 cm apart, per the supplied packaging ({{spec}}). Treatment cycle: 3-4 sessions at 2 week intervals, then monthly maintenance.`,
  'dermagen': `Topical formulations: apply a thin layer to clean, dry skin in the targeted area, frequency as directed on the carton (typically 1-2 times daily). For prescription-strength Dermagen products, start with every-other-day application. Discontinue if severe irritation occurs and consult a professional. Pair daytime application with broad-spectrum SPF 30+ sunscreen.`,
  'gtm': `Apply per GTM product type ({{name}}). For pre-mixed serums and creams: thin layer to clean, dry skin, 1-2 times daily. For in-clinic peel preparations: brush evenly onto the treatment area, neutralize per the manufacturer's protocol after the prescribed exposure time, rinse thoroughly. Avoid sun exposure and apply broad-spectrum SPF 30+ during recovery.`,
  'equipment': `Reserved for trained operators. Read the manufacturer manual before first use. Inspect the device for damage, calibrate per manual, ensure all consumables (gels, electrodes, tips) are current. Configure parameters (energy / depth / frequency) per the treatment indication and patient skin type. Treat in controlled, evenly distributed passes; monitor patient feedback. Post-procedure: cooling, hydration, and SPF 30+ during recovery.`,
  'salon-grade': `Professional spa or salon use. Apply per product type ({{name}}): cleansers and lotions follow standard pre-treatment cleansing; modeling and massage products are applied to the prepared treatment area per the manufacturer-recommended technique and exposure time. Rinse or remove thoroughly per protocol.`,
  'lipolytics': `Restricted to licensed practitioners. Pre-treatment: medical history review, target-area markup, sterile preparation. Use a 27-30G needle. Inject subcutaneously into the fat compartment at the marked grid points, depth 6-13 mm depending on tissue thickness, 0.1-0.4 mL per point per the product strength ({{spec}}). Treatment cycle: 2-6 sessions at 4-6 week intervals. Post-procedure: compression garment if applicable, expect mild swelling and tenderness for 3-7 days.`,
  'botulinum': `Reconstitute the lyophilized powder with 0.9% saline per the manufacturer's dilution table ({{spec}}). Use a 30-32G needle. Inject 0.1 mL per point at marked muscle landmarks; typical glabellar pattern is 5 points (corrugator + procerus). Onset 3-7 days, peak effect at 2 weeks. Re-treatment interval 3-4 months. Contraindications: pregnancy, lactation, neuromuscular disease, active infection at the injection site. Post-injection: no rubbing or bending forward for 4 hours.`,
  'injections': `Restricted to licensed practitioners. Reconstitute (if applicable) per the package insert. Use a 27-30G needle. Administration route is per product class ({{spec}}): intramuscular, intravenous slow-push, or subcutaneous. Aspirate before injection. Monitor the patient through the procedure; observe for the first 15-30 minutes for hypersensitivity. Treatment cycle is product-specific — follow the package insert.`,
  'anesthetics': `Topical surface anesthetic. Apply a thick layer to clean, dry skin over the procedure area, cover with occlusive film, leave on for 20-60 minutes per concentration ({{spec}}). Remove film, wipe excess cream, then commence the planned procedure immediately. Do not exceed the maximum recommended application area or duration to avoid systemic absorption. Discontinue if irritation develops.`,
  'placental-therapy': `Restricted to licensed practitioners. Reconstitute as supplied ({{spec}}). Administration: intramuscular (gluteal or deltoid) or subcutaneous mesotherapy per the product label. Standard course: 2-3 ampoules per week for 4-8 weeks, then monthly maintenance. Monitor for hypersensitivity during the first 15 minutes post-injection. Contraindications: known allergy to placental proteins, pregnancy, autoimmune disease.`,
  'nano-needle-cannula': `Sterile single-patient use. Inspect packaging for integrity before opening. Attach to a Luer-lock syringe; prime with the selected injectable. Insert at the planned entry point at the intended depth (typically 1-4 mm for mesotherapy needles, 5-13 mm for cannulas). Deliver the product slowly to minimize tissue trauma. Withdraw, apply pressure briefly, dispose in a sharps container.`,
  'imported-products': `Restricted to licensed practitioners. Follow the manufacturer's label, prescriber direction, and applicable local regulations for the specific imported brand ({{name}}). Reconstitution, needle gauge, injection depth, and treatment cycle are product-specific — refer to the official insert supplied with the carton. Confirm cold-chain integrity before use; do not use if the product is past its expiration date or shows particulate contamination.`,
};

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

function substitute(template: string, p: Product): string {
  const spec = (p.specification && p.specification.trim()) || '—';
  const pkg = ((p.packaging as string | undefined)?.trim()) || '—';
  return template
    .replace(/\{\{spec\}\}/g, spec)
    .replace(/\{\{packaging\}\}/g, pkg)
    .replace(/\{\{name\}\}/g, p.name);
}

function isStubProtocol(s: string | undefined): boolean {
  if (!s) return true;
  return STUB_RE.test(s.trim());
}

function main(): void {
  const backupPath = backupDataFile();
  console.log(`apply-protocol-templates: backup → ${backupPath}`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;

  const applied: Array<{ id: number; name: string; categoryId: string }> = [];
  const skipped: Array<{ id: number; name: string; reason: string }> = [];

  for (const p of data.products) {
    const tmpl = TEMPLATES[p.categoryId];
    if (!tmpl) {
      skipped.push({ id: p.id, name: p.name, reason: `no template for category ${p.categoryId}` });
      continue;
    }
    if (!isStubProtocol(p.protocol)) {
      skipped.push({ id: p.id, name: p.name, reason: 'has Jotform-derived protocol' });
      continue;
    }
    const next = substitute(tmpl, p);
    if (p.protocol === next) continue;
    p.protocol = next;
    applied.push({ id: p.id, name: p.name, categoryId: p.categoryId });
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  const lines: string[] = [];
  lines.push('# apply-protocol-templates report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`applied: ${applied.length}  skipped: ${skipped.length}`);
  lines.push('');
  lines.push(`## Applied (${applied.length})`);
  for (const a of applied) lines.push(`  #${a.id}  [${a.categoryId}]  ${a.name}`);
  lines.push('');
  lines.push(`## Skipped (${skipped.length})`);
  for (const s of skipped) lines.push(`  #${s.id}  ${s.name}  --  ${s.reason}`);
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');

  console.log(`apply-protocol-templates: applied=${applied.length} skipped=${skipped.length}`);
  console.log(`apply-protocol-templates: report → ${REPORT_PATH}`);
}

main();
```

- [ ] **Step 2**: Run:

```bash
npx tsx scripts/apply-protocol-templates.ts
```

Expected: `applied=~410 skipped=~10` and a backup path.

- [ ] **Step 3**: Verify idempotence — run again:

```bash
npx tsx scripts/apply-protocol-templates.ts
```

Expected: `applied=0 skipped=~420` (every product's protocol now matches its template, so the `if (p.protocol === next) continue;` line short-circuits everything).

- [ ] **Step 4**: Spot-check:

```bash
grep -A 22 '"id": 1,' data/products.json | grep -A 1 protocol | head -3
grep -A 22 '"id": 110,' data/products.json | grep -A 1 protocol | head -3
grep -A 22 '"id": 320,' data/products.json | grep -A 1 protocol | head -3
```

Expected:
- id 1 (BARBIE SLIM, lipolytics): protocol contains "27-30G needle" / "subcutaneously".
- id 110 (JUVELOOK i): protocol still has Jotform text ("2-3 sessions, every 4-6 weeks").
- id 320 (BOTULAX): protocol contains "0.9% saline" and "30-32G needle".

- [ ] **Step 5**: TypeScript check:

```bash
npx tsc --noEmit -p tsconfig.json
```

Zero errors.

- [ ] **Step 6**: Commit:

```bash
git add scripts/apply-protocol-templates.ts data/products.json scripts/apply-protocol-templates-report.txt
git commit -m "feat(scripts): apply protocol category templates to all products"
```

---

## Task 4: Manual verification

**Files:** none modified.

- [ ] **Step 1**: Open the verification report:

```bash
head -40 scripts/verify-jotform-matches-report.txt
```

Note any obvious mismatches (e.g. "BARBIE SLIM" with a JUVIDERM description) — relay to user as a follow-up list.

- [ ] **Step 2**: Open the protocol report:

```bash
head -40 scripts/apply-protocol-templates-report.txt
```

Sanity-check counts. Confirm applied ≈ 410, skipped ≈ 10 (10 being the products with Jotform-derived protocols).

- [ ] **Step 3**: Browser check — visit one product per category. The protocol section should read like clinical guidance (needle gauge, injection depth, treatment cycle).

---

## Out of scope (follow-ups)

- Resolving suspicious entries in `verify-jotform-matches-report.txt` —
  human-judged corrections, not in this plan.
- Per-product web research (deferred indefinitely by the user).
- `data/translations/` updates for the new protocol text.
