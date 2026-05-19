# Jotform Descriptions Import (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the prose copy (Description / Indication / Packaging / Protocol) from the public Jotform order form into `data/products.json`, replacing the LLM-generated stubs wherever the form provides real content.

**Architecture:** A single Node script (`scripts/import-jotform-descriptions.ts`) re-fetches the Jotform HTML, diffs against the locally cached copy, parses every product card, splits each card's description blob into the four prose fields using keyword anchors, fuzzy-matches by name to our products, and overwrites only the fields where the Jotform record produced real content. A report file enumerates Phase 2 candidates.

**Tech Stack:** TypeScript via `tsx`, axios for the fetch, the existing `scripts/lib/fuzzy-match.ts` for matching. No test framework — verification is via the report file and manual browser spot checks.

**Spec:** `docs/superpowers/specs/2026-05-19-jotform-descriptions-design.md`

---

## File Structure

**New files:**
- `scripts/import-jotform-descriptions.ts` — orchestrator (fetch, parse, split, match, apply, report).
- `scripts/import-jotform-descriptions-report.txt` — generated each run.

**Modified files:**
- `package.json` — npm alias `"import-jotform-descriptions"`.
- `data/products.json` — rewritten by the script.
- `scripts/jotform-raw.html` — updated only if the live form changed.
- `data/backups/products-{timestamp}.json` — auto-created.

**Read-only inputs:**
- The live Jotform URL (`https://form.jotform.com/shcoresteticsglobal/skin-global-product-order-form`).
- `scripts/lib/fuzzy-match.ts` — exported `normalise` and `scoreMatch`.

---

## Task 1: npm script alias + scaffold

**Files:**
- Modify: `package.json`
- Create: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add the npm alias**

Edit `package.json`. In the `scripts` block, after the existing `"catalogue-fixes"` entry, add:

```json
    "import-jotform-descriptions": "tsx scripts/import-jotform-descriptions.ts",
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
```

Expected: no output.

- [ ] **Step 3: Create the script skeleton**

Create `scripts/import-jotform-descriptions.ts` with:

```ts
/**
 * Phase 1: import Jotform description prose into products.json.
 *
 * 1. Fetch the live HTML and byte-diff against scripts/jotform-raw.html.
 *    Replace the local copy only if it changed.
 * 2. Parse every product card (aria-label + form-product-description).
 * 3. Split the description blob into description / indication / protocol /
 *    packaging using keyword anchors.
 * 4. Fuzzy-match Jotform name to products.json.
 * 5. Apply only fields the Jotform record actually produced.
 * 6. Write a report.
 *
 * Idempotent — running twice on the same source produces no change.
 */
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { normalise, scoreMatch } from './lib/fuzzy-match';

const JOTFORM_URL = 'https://form.jotform.com/shcoresteticsglobal/skin-global-product-order-form';

const ROOT = process.cwd();
const DATA_FILE = path.join(ROOT, 'data', 'products.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');
const RAW_HTML_PATH = path.join(ROOT, 'scripts', 'jotform-raw.html');
const REPORT_PATH = path.join(ROOT, 'scripts', 'import-jotform-descriptions-report.txt');

const RICH_MIN_CHARS = 100;
const MATCH_THRESHOLD = 2;

function main(): void {
  console.log('import-jotform-descriptions: starting');
  // populated by later tasks
}

main();
```

- [ ] **Step 4: Smoke run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected: `import-jotform-descriptions: starting`. No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/import-jotform-descriptions.ts
git commit -m "chore(scripts): scaffold import-jotform-descriptions"
```

---

## Task 2: Fetch + diff

**Files:**
- Modify: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add the fetch helper**

Above `main()`:

```ts
async function fetchHtml(url: string): Promise<string> {
  const res = await axios.get<string>(url, {
    timeout: 60_000,
    responseType: 'text',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  return res.data;
}

async function loadOrRefreshHtml(): Promise<{ html: string; refreshed: boolean }> {
  let live: string;
  try {
    live = await fetchHtml(JOTFORM_URL);
  } catch (err) {
    console.warn(`fetch failed (${(err as Error).message}); falling back to cached HTML.`);
    if (!fs.existsSync(RAW_HTML_PATH)) throw new Error('No cached HTML and live fetch failed.');
    return { html: fs.readFileSync(RAW_HTML_PATH, 'utf8'), refreshed: false };
  }
  const cached = fs.existsSync(RAW_HTML_PATH) ? fs.readFileSync(RAW_HTML_PATH, 'utf8') : '';
  if (cached && cached === live) {
    return { html: cached, refreshed: false };
  }
  fs.writeFileSync(RAW_HTML_PATH, live, 'utf8');
  return { html: live, refreshed: true };
}
```

- [ ] **Step 2: Wire into `main` and make it async**

Replace `main` with:

```ts
async function main(): Promise<void> {
  console.log('import-jotform-descriptions: fetching');
  const { html, refreshed } = await loadOrRefreshHtml();
  console.log(`import-jotform-descriptions: HTML ${refreshed ? 'refreshed' : 'unchanged'}, ${html.length} bytes`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected: `HTML unchanged, NNNNN bytes` (because the cached file should still match the live form). If it refreshed, fine — the cache will be updated.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-jotform-descriptions.ts
git commit -m "feat(scripts): import-jotform fetch + cache diff"
```

---

## Task 3: Parse product cards

**Files:**
- Modify: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add the parser**

Above `main`:

```ts
interface JotformRecord {
  name: string;
  text: string;
}

const ARIA_RE = /aria-label="Select Product: ([^"]+)"/g;
const DESC_RE = /class="form-product-description"[^>]*>([\s\S]*?)<\/div>/;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  // Replace <br> and </p>/</div> with spaces to preserve word boundaries.
  const spaced = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>/gi, ' ');
  return decodeHtmlEntities(spaced.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-—–•·]+|[\s\-—–•·]+$/g, '')
    .trim();
}

export function parseJotform(html: string): JotformRecord[] {
  const records: JotformRecord[] = [];
  let m: RegExpExecArray | null;
  ARIA_RE.lastIndex = 0;
  while ((m = ARIA_RE.exec(html)) !== null) {
    const name = cleanName(m[1]);
    // Look ahead up to 8 KB for the description block inside the same card.
    const slice = html.slice(m.index, m.index + 8000);
    const descMatch = slice.match(DESC_RE);
    if (!descMatch) {
      records.push({ name, text: '' });
      continue;
    }
    records.push({ name, text: stripTags(descMatch[1]) });
  }
  return records;
}
```

- [ ] **Step 2: Wire into `main`**

Update `main` to:

```ts
async function main(): Promise<void> {
  console.log('import-jotform-descriptions: fetching');
  const { html, refreshed } = await loadOrRefreshHtml();
  console.log(`import-jotform-descriptions: HTML ${refreshed ? 'refreshed' : 'unchanged'}, ${html.length} bytes`);

  const records = parseJotform(html);
  const rich = records.filter(r => r.text.length >= RICH_MIN_CHARS);
  const specOnly = records.filter(r => r.text.length > 0 && r.text.length < RICH_MIN_CHARS);
  const empty = records.filter(r => r.text.length === 0);
  console.log(`import-jotform-descriptions: parsed ${records.length} (rich=${rich.length} spec-only=${specOnly.length} empty=${empty.length})`);
}
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected: `parsed 511 (rich=~77 spec-only=~423 empty=~11)`. Numbers may vary slightly if the form has been updated.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-jotform-descriptions.ts
git commit -m "feat(scripts): import-jotform parser (aria-label + description block)"
```

---

## Task 4: Field splitter

**Files:**
- Modify: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add the splitter**

Above `main`:

```ts
interface SplitResult {
  description: string;
  indication: string;
  protocol: string;
  packaging: string;
}

// Ordered by priority — first keyword wins for each section.
const SECTION_KEYWORDS: Array<{ key: keyof SplitResult; re: RegExp }> = [
  { key: 'indication', re: /\bIndications?\s*:\s*/i },
  { key: 'protocol',   re: /\b(?:Treatment\s+Protocol|Protocol|How\s+to\s+use|Directions|Application)\s*:\s*/i },
  { key: 'packaging',  re: /\b(?:Packaging|Pack|Volume|Pkg)\s*:\s*/i },
];

interface SectionMatch {
  key: keyof SplitResult;
  start: number;
  contentStart: number;
}

export function splitText(text: string): SplitResult {
  // Find every section keyword position in the text.
  const found: SectionMatch[] = [];
  for (const { key, re } of SECTION_KEYWORDS) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (!m) continue;
    found.push({ key, start: m.index, contentStart: m.index + m[0].length });
  }
  found.sort((a, b) => a.start - b.start);

  const out: SplitResult = { description: '', indication: '', protocol: '', packaging: '' };

  if (found.length === 0) {
    out.description = text.trim();
    return out;
  }

  out.description = text.slice(0, found[0].start).trim();
  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const end = i + 1 < found.length ? found[i + 1].start : text.length;
    out[cur.key] = text.slice(cur.contentStart, end).trim();
  }
  return out;
}
```

- [ ] **Step 2: Add a sanity check to `main`**

Replace the last `console.log` in `main` with:

```ts
  const samples = [
    'PDRENZA SERUM',
    'MELANOSA',
    'MisAdi',
  ];
  for (const tag of samples) {
    const r = records.find(rec => rec.name.toUpperCase().includes(tag.toUpperCase()));
    if (!r) continue;
    const s = splitText(r.text);
    console.log(`  ${r.name}: desc=${s.description.length} ind=${s.indication.length} prot=${s.protocol.length} pkg=${s.packaging.length}`);
  }
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected output (lengths will vary, but PDRENZA should have a packaging > 0; MELANOSA should have indication > 0 AND protocol > 0; MisAdi has spec-only text so all four end up tiny):

```
  PDRENZA SERUM & CREAM SET: desc=270 ind=0 prot=0 pkg=180
  MELANOSA CREAM (Hydroquinone 4%) 30g: desc=180 ind=140 prot=130 pkg=0
  MisAdi Beso: desc=30 ind=0 prot=0 pkg=0
```

- [ ] **Step 4: Remove the sanity check**

Delete the samples loop. The splitter stays.

- [ ] **Step 5: Commit**

```bash
git add scripts/import-jotform-descriptions.ts
git commit -m "feat(scripts): import-jotform field splitter"
```

---

## Task 5: Fuzzy matching

**Files:**
- Modify: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add types and the matcher**

Above `main`:

```ts
interface Product {
  id: number;
  name: string;
  description: string;
  indication?: string;
  protocol?: string;
  packaging?: string;
  [k: string]: unknown;
}
interface DataFile { products: Product[]; categories: unknown[] }

interface Match {
  product: Product;
  record: JotformRecord;
  score: number;
}

function matchAll(products: Product[], records: JotformRecord[]): {
  matches: Match[];
  unmatchedProducts: Product[];
  unmatchedRecords: JotformRecord[];
} {
  const matches: Match[] = [];
  const consumed = new Set<JotformRecord>();
  // Greedy longest-name-first to reduce conflicts.
  const ordered = [...products].sort((a, b) => b.name.length - a.name.length);

  for (const product of ordered) {
    const pnorm = normalise(product.name);
    let best: { rec: JotformRecord; score: number } | null = null;
    for (const rec of records) {
      if (consumed.has(rec)) continue;
      const s = scoreMatch(pnorm, normalise(rec.name));
      if (!best || s > best.score) best = { rec, score: s };
    }
    if (best && best.score >= MATCH_THRESHOLD) {
      consumed.add(best.rec);
      matches.push({ product, record: best.rec, score: best.score });
    }
  }

  const matchedIds = new Set(matches.map(m => m.product.id));
  const unmatchedProducts = products.filter(p => !matchedIds.has(p.id));
  const unmatchedRecords = records.filter(r => !consumed.has(r));
  return { matches, unmatchedProducts, unmatchedRecords };
}
```

- [ ] **Step 2: Wire into `main`**

Add right after the parse block:

```ts
  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  const result = matchAll(data.products, records);
  console.log(`import-jotform-descriptions: matched ${result.matches.length}/${data.products.length} products (unmatched products=${result.unmatchedProducts.length} unmatched records=${result.unmatchedRecords.length})`);
```

- [ ] **Step 3: Run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected: matched count should be ~350-400 of 421 (most products have a Jotform counterpart). Unmatched products list will be small.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-jotform-descriptions.ts
git commit -m "feat(scripts): import-jotform fuzzy matcher"
```

---

## Task 6: Apply fields + backup + write

**Files:**
- Modify: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add the backup helper**

Above `main`:

```ts
function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}
```

- [ ] **Step 2: Add the apply helper**

```ts
interface AppliedRow {
  id: number;
  name: string;
  changedFields: Array<keyof SplitResult>;
}

interface PhaseTwoRow {
  id: number;
  name: string;
  jotformText: string;
}

function applyRichRecords(matches: Match[]): { applied: AppliedRow[]; phaseTwo: PhaseTwoRow[] } {
  const applied: AppliedRow[] = [];
  const phaseTwo: PhaseTwoRow[] = [];

  for (const m of matches) {
    if (m.record.text.length < RICH_MIN_CHARS) {
      phaseTwo.push({ id: m.product.id, name: m.product.name, jotformText: m.record.text });
      continue;
    }
    const split = splitText(m.record.text);
    const changed: Array<keyof SplitResult> = [];

    // Description: overwrite when Jotform produced any non-empty value
    if (split.description && split.description !== m.product.description) {
      m.product.description = split.description;
      changed.push('description');
    }
    for (const key of ['indication', 'protocol', 'packaging'] as const) {
      const value = split[key];
      if (!value) continue;
      if (m.product[key] !== value) {
        m.product[key] = value;
        changed.push(key);
      }
    }
    if (changed.length > 0) {
      applied.push({ id: m.product.id, name: m.product.name, changedFields: changed });
    }
  }
  return { applied, phaseTwo };
}
```

- [ ] **Step 3: Wire into `main`**

Append after the match block:

```ts
  const backupPath = backupDataFile();
  console.log(`import-jotform-descriptions: backup → ${backupPath}`);

  const { applied, phaseTwo } = applyRichRecords(result.matches);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log(`import-jotform-descriptions: applied=${applied.length} phase-two-candidates=${phaseTwo.length} unmatched-products=${result.unmatchedProducts.length}`);
```

- [ ] **Step 4: Run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected: `applied=~70 phase-two-candidates=~280 unmatched-products=~30`. The JSON file is updated.

- [ ] **Step 5: Spot-check a known-rich product**

```bash
grep -B 1 -A 20 '"name": "MELANOSA' data/products.json | head -25
```

(Use whichever rich product name you find easily. PDRENZA, MELANOSA, CURENEX SCULP (PLLA), or any of the early Jotform entries that have keyword-bearing text.)

Expect a longer `description`, populated `indication`, populated `protocol` (and `packaging` if PDRENZA).

- [ ] **Step 6: Commit**

```bash
git add scripts/import-jotform-descriptions.ts data/products.json
git commit -m "feat(scripts): import-jotform apply rich records to products.json"
```

---

## Task 7: Report file

**Files:**
- Modify: `scripts/import-jotform-descriptions.ts`

- [ ] **Step 1: Add the formatter**

Above `main`:

```ts
function formatReport(args: {
  refreshed: boolean;
  parsed: { total: number; rich: number; specOnly: number; empty: number };
  applied: AppliedRow[];
  phaseTwo: PhaseTwoRow[];
  unmatchedProducts: Product[];
  unmatchedRecords: JotformRecord[];
}): string {
  const lines: string[] = [];
  lines.push('# import-jotform-descriptions report');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push(`html: ${args.refreshed ? 'refreshed from live form' : 'cached copy used'}`);
  lines.push(`parsed: total=${args.parsed.total} rich=${args.parsed.rich} spec-only=${args.parsed.specOnly} empty=${args.parsed.empty}`);
  lines.push('');

  lines.push(`## Applied (${args.applied.length})`);
  for (const a of args.applied) {
    lines.push(`  #${a.id}  ${a.name}  fields=[${a.changedFields.join(', ')}]`);
  }
  lines.push('');

  lines.push(`## Phase 2 candidates — matched but Jotform text was spec-only (${args.phaseTwo.length})`);
  for (const p of args.phaseTwo) {
    const preview = p.jotformText.slice(0, 80);
    lines.push(`  #${p.id}  ${p.name}  jotform="${preview}"`);
  }
  lines.push('');

  lines.push(`## Unmatched products — no Jotform counterpart (${args.unmatchedProducts.length})`);
  for (const p of args.unmatchedProducts) {
    lines.push(`  #${p.id}  ${p.name}`);
  }
  lines.push('');

  lines.push(`## Unmatched Jotform records — no products.json counterpart (${args.unmatchedRecords.length})`);
  for (const r of args.unmatchedRecords) {
    lines.push(`  ${r.name}  (text-length=${r.text.length})`);
  }
  return lines.join('\n') + '\n';
}
```

- [ ] **Step 2: Wire into `main`**

Replace the trailing `console.log` block in `main` with:

```ts
  const reportText = formatReport({
    refreshed,
    parsed: { total: records.length, rich: rich.length, specOnly: specOnly.length, empty: empty.length },
    applied,
    phaseTwo,
    unmatchedProducts: result.unmatchedProducts,
    unmatchedRecords: result.unmatchedRecords,
  });
  fs.writeFileSync(REPORT_PATH, reportText, 'utf8');

  console.log(`import-jotform-descriptions: applied=${applied.length} phase-two=${phaseTwo.length} unmatched-products=${result.unmatchedProducts.length} unmatched-records=${result.unmatchedRecords.length}`);
  console.log(`import-jotform-descriptions: report → ${REPORT_PATH}`);
```

Note: `rich`, `specOnly`, `empty` are computed earlier in `main` (Task 3). Confirm those variables are still in scope; if not, recompute them before calling `formatReport`.

- [ ] **Step 3: End-to-end run**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expected: the script prints the summary and writes the report. Open the report:

```bash
head -30 scripts/import-jotform-descriptions-report.txt
```

You should see Applied / Phase 2 / Unmatched sections, all populated.

- [ ] **Step 4: Verify idempotence**

```bash
npx tsx scripts/import-jotform-descriptions.ts
```

Expect `applied=0` on the second run (every match's fields already equal the Jotform-derived values). `phase-two` and `unmatched` counts stay the same.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit -p tsconfig.json
```

Zero errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/import-jotform-descriptions.ts scripts/import-jotform-descriptions-report.txt
git commit -m "feat(scripts): import-jotform report"
```

---

## Task 8: Manual verification

**Files:**
- None modified.

- [ ] **Step 1: Boot dev server**

If not already running:

```bash
npm run dev
```

- [ ] **Step 2: Open a rich product in the browser**

Find an id from the report's Applied section (PDRENZA / MELANOSA / similar). Visit `/en/product/<id>` and confirm:
- The Description tab shows the Salmon-PDRN / hydroquinone / etc opening sentence
- Indication / Protocol / Packaging tabs (whichever the Jotform entry produced) show their respective content
- No section is empty if it had Jotform content

- [ ] **Step 3: Open a spec-only product**

Pick a product from the Phase 2 candidates list (MisAdi Beso = id 2, or any short-text entry). Visit its detail page. Description should still show the original LLM stub (we did not overwrite when Jotform text was spec-only).

- [ ] **Step 4: Open the report**

```bash
wc -l scripts/import-jotform-descriptions-report.txt
head -50 scripts/import-jotform-descriptions-report.txt
```

Scan the Applied list for any names that look unexpected (e.g. a misnamed product getting the wrong rich text). If anything is suspicious, note the id and add to a follow-up.

- [ ] **Step 5: Note Phase 2 scope for the user**

Tell the user: "Phase 1 applied N rich descriptions. Phase 2 candidates: M products still on LLM-stub copy. Ready to start Phase 2 (web research) when you say so."

- [ ] **Step 6: If anything failed**

Restore from the most-recent backup and investigate:

```bash
ls data/backups/products-*.json | tail -1
```

Copy that file over `data/products.json`, identify the bug, fix and re-run.

---

## Out of scope (follow-ups)

- Phase 2 — web research for products still on the LLM stub. Separate plan when the user has reviewed the Phase 1 report.
- Phase 3 — protocol detail enhancement via category templates. Separate plan after Phase 2.
- Re-translating `data/translations/ru.json` and `ko.json` for products whose `description` / `indication` / `protocol` changed in Phase 1.
- Reconciling minor name variants (e.g. "REGENOVUE FINE (CE) No Lidocaine" in Jotform vs "REGENOVUE FINE (CE)" in our JSON) — the fuzzy matcher handles this, but the report will surface false unmatches if any slip through.
