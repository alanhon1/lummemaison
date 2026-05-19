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

// --- Fetch + diff ------------------------------------------------------------

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

// --- Parse -------------------------------------------------------------------

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

// --- Field splitter ----------------------------------------------------------

interface SplitResult {
  description: string;
  indication: string;
  protocol: string;
  packaging: string;
}

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

// --- Fuzzy match -------------------------------------------------------------

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

// --- Apply rich records ------------------------------------------------------

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

// --- Backup helper -----------------------------------------------------------

function backupDataFile(): string {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `products-${stamp}.json`);
  fs.copyFileSync(DATA_FILE, dest);
  return dest;
}

// --- Report formatter --------------------------------------------------------

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

  lines.push(`## Phase 2 candidates - matched but Jotform text was spec-only (${args.phaseTwo.length})`);
  for (const p of args.phaseTwo) {
    const preview = p.jotformText.slice(0, 80);
    lines.push(`  #${p.id}  ${p.name}  jotform="${preview}"`);
  }
  lines.push('');

  lines.push(`## Unmatched products - no Jotform counterpart (${args.unmatchedProducts.length})`);
  for (const p of args.unmatchedProducts) {
    lines.push(`  #${p.id}  ${p.name}`);
  }
  lines.push('');

  lines.push(`## Unmatched Jotform records - no products.json counterpart (${args.unmatchedRecords.length})`);
  for (const r of args.unmatchedRecords) {
    lines.push(`  ${r.name}  (text-length=${r.text.length})`);
  }
  return lines.join('\n') + '\n';
}

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('import-jotform-descriptions: fetching');
  const { html, refreshed } = await loadOrRefreshHtml();
  console.log(`import-jotform-descriptions: HTML ${refreshed ? 'refreshed' : 'unchanged'}, ${html.length} bytes`);

  const records = parseJotform(html);
  const rich = records.filter(r => r.text.length >= RICH_MIN_CHARS);
  const specOnly = records.filter(r => r.text.length > 0 && r.text.length < RICH_MIN_CHARS);
  const empty = records.filter(r => r.text.length === 0);
  console.log(`import-jotform-descriptions: parsed ${records.length} (rich=${rich.length} spec-only=${specOnly.length} empty=${empty.length})`);

  const raw = fs.readFileSync(DATA_FILE, 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw) as DataFile;
  const result = matchAll(data.products, records);
  console.log(`import-jotform-descriptions: matched ${result.matches.length}/${data.products.length} products`);

  const backupPath = backupDataFile();
  console.log(`import-jotform-descriptions: backup -> ${backupPath}`);

  const { applied, phaseTwo } = applyRichRecords(result.matches);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

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
  console.log(`import-jotform-descriptions: report -> ${REPORT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
