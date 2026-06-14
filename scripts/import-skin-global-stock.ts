import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';

const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, 'Skin Global Stock NoPrice.xlsx');
const PRODUCTS_PATH = path.join(ROOT, 'data', 'products.json');
const MAP_PATH = path.join(ROOT, 'scripts', 'skin-global-manual-map.json');
const SQL_OUT = path.join(ROOT, 'docs', 'superpowers', 'plans', 'stock-import.generated.sql');
const REPORT_OUT = path.join(ROOT, 'docs', 'superpowers', 'plans', 'stock-import-report.md');

interface Prod { id: number; name: string; spec: string; desc: string }

function norm(s: string): string {
  return String(s).toUpperCase().replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/[^A-Z0-9]/g, '');
}
// Fuzzy "core": also drop volume/unit/quantity tokens so variants collapse.
function core(s: string): string {
  return String(s).toUpperCase()
    .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(ML|L|G|MG|KG|IU|U|PCS|BOX|AMP|VIAL|MASKS?|UNITS?)\b/g, ' ')
    .replace(/\bX\s*\d+\b/g, ' ')
    .replace(/[^A-Z0-9]/g, '');
}

// Significant name tokens for fuzzy candidate suggestions (brand/product words,
// dropping units, sizes, and generic dosage-form words).
const STOP = new Set(['INJ', 'CREAM', 'SPRAY', 'GEL', 'SERUM', 'MASK', 'TAB', 'TABS', 'AMP', 'VIAL', 'BOX', 'PCS', 'UNIT', 'UNITS', 'PLUS', 'SOLUTION', 'ESSENCE', 'CLEANSER', 'FOAM', 'PACK', 'BOOSTER', 'AMPOULE', 'POWDER', 'THE', 'FOR', 'AND', 'WITH']);
function tokens(s: string): string[] {
  return [...new Set(
    String(s).toUpperCase().replace(/[^A-Z0-9]/g, ' ').split(/\s+/)
      .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !STOP.has(t)),
  )];
}

const wb = xlsx.readFile(XLSX_PATH);
const rawRows = xlsx.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
const xlsxItems = rawRows.slice(2)
  .filter(r => String(r[0]).trim())
  .map(r => ({ name: String(r[0]).trim(), qty: Math.max(0, Math.floor(Number(r[1]) || 0)) }));

const prodRaw = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
const products: Prod[] = (Array.isArray(prodRaw) ? prodRaw : prodRaw.products || Object.values(prodRaw))
  .map((p: { id: number; name: string; specification?: string; description?: string }) => ({
    id: p.id,
    name: String(p.name),
    spec: String(p.specification ?? ''),
    desc: String(p.description ?? '').slice(0, 90),
  }));

const manual = JSON.parse(readFileSync(MAP_PATH, 'utf8')).mappings as Record<string, number>;

const byExact = new Map<string, Prod>();
const byNorm = new Map<string, Prod[]>();
const byCore = new Map<string, Prod[]>();
for (const p of products) {
  byExact.set(p.name.trim().toUpperCase(), p);
  const n = norm(p.name);
  if (!byNorm.has(n)) byNorm.set(n, []);
  byNorm.get(n)!.push(p);
  const c = core(p.name);
  if (!byCore.has(c)) byCore.set(c, []);
  byCore.get(c)!.push(p);
}

const matched: { name: string; qty: number; id: number; how: string }[] = [];
const skipped: string[] = [];
const report: { name: string; qty: number; candidates: Prod[] }[] = [];

for (const it of xlsxItems) {
  if (Object.prototype.hasOwnProperty.call(manual, it.name)) {
    const id = manual[it.name];
    if (id === 0) { skipped.push(it.name); continue; }
    matched.push({ name: it.name, qty: it.qty, id, how: 'manual' });
    continue;
  }
  const exact = byExact.get(it.name.toUpperCase());
  if (exact) { matched.push({ name: it.name, qty: it.qty, id: exact.id, how: 'exact' }); continue; }
  const n = byNorm.get(norm(it.name));
  if (n && n.length === 1) { matched.push({ name: it.name, qty: it.qty, id: n[0].id, how: 'normalized' }); continue; }
  // Fuzzy core: if exactly one site product shares the volume/variant-stripped
  // core, auto-accept it (flagged 'core' so the owner can skim these).
  const c = byCore.get(core(it.name));
  if (c && c.length === 1) { matched.push({ name: it.name, qty: it.qty, id: c[0].id, how: 'core' }); continue; }
  // ambiguous or unmatched → suggest candidates. Prefer core/normalized hits;
  // otherwise score all products by shared significant name tokens (top 4).
  let cands = (c ?? n ?? []).slice(0, 6);
  if (cands.length === 0) {
    const itTokens = tokens(it.name);
    const scored = products
      .map(p => ({ p, score: tokens(p.name).filter(t => itTokens.includes(t)).length }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(x => x.p);
    cands = scored;
  }
  report.push({ name: it.name, qty: it.qty, candidates: cands });
}

// Collision guard: if two different xlsx items resolved to the same site
// product, keep only the highest-confidence one (manual > exact > normalized >
// core) and push the rest to the report so the owner can confirm whether they
// are the same product (combine) or a separate SKU (skip).
const prodById = new Map(products.map(p => [p.id, p]));
const rank: Record<string, number> = { manual: 0, exact: 1, normalized: 2, core: 3 };
const bestById = new Map<number, typeof matched[number]>();
const collisions: typeof matched = [];
for (const m of matched) {
  const cur = bestById.get(m.id);
  if (!cur) { bestById.set(m.id, m); continue; }
  if (rank[m.how] < rank[cur.how]) { collisions.push(cur); bestById.set(m.id, m); }
  else { collisions.push(m); }
}
const finalMatched = [...bestById.values()];
for (const c of collisions) {
  const p = prodById.get(c.id);
  report.push({ name: c.name, qty: c.qty, candidates: p ? [p] : [] });
}

// Emit import SQL (confident + manual).
const matchedForSql = finalMatched;
const sql = [
  '-- Generated by scripts/import-skin-global-stock.ts. Run in Supabase SQL editor.',
  '-- Sets real stock from Skin Global Stock NoPrice.xlsx for matched products.',
  ...matchedForSql.map(m =>
    `insert into public.product_stock (product_id, stock, stock_unknown) values (${m.id}, ${m.qty}, false) ` +
    `on conflict (product_id) do update set stock = excluded.stock, stock_unknown = false; -- ${m.name} [${m.how}]`),
  '',
].join('\n');
writeFileSync(SQL_OUT, sql);

// Emit the owner report.
const fuzzy = finalMatched.filter(m => m.how === 'core');
const rep = [
  `# Stock Import Report — ${xlsxItems.length} xlsx products`,
  '',
  `- Matched (will be in the SQL): **${finalMatched.length}** (exact/normalized: ${finalMatched.length - fuzzy.length}, fuzzy 'core': ${fuzzy.length})`,
  `- Skipped (manual map = 0, not on site): **${skipped.length}**`,
  `- Needs your decision: **${report.length}**`,
  '',
  '## Fuzzy auto-matches — please skim (tell me if any are wrong)',
  'These were matched after stripping volume/variant tokens. Usually right, but double-check.',
  '',
  ...fuzzy.map(m => {
    const p = prodById.get(m.id);
    return `- **${m.name}** (qty ${m.qty}) → #${m.id} ${p?.name ?? '?'} — spec: ${p?.spec || '—'}`;
  }),
  '',
  '## Needs your decision',
  'For each, reply with the site product id (or "skip"). Best-guess candidates shown.',
  '',
  ...report.map(r => {
    if (!r.candidates.length) return `- **${r.name}** (qty ${r.qty}) — (no candidates found)`;
    const cands = r.candidates
      .map(c => `\n    - #${c.id} ${c.name} — spec: ${c.spec || '—'}${c.desc ? ` — ${c.desc}…` : ''}`)
      .join('');
    return `- **${r.name}** (qty ${r.qty})${cands}`;
  }),
  '',
].join('\n');
writeFileSync(REPORT_OUT, rep);

console.log(`xlsx=${xlsxItems.length} matched=${finalMatched.length} skipped=${skipped.length} needsDecision=${report.length}`);
console.log(`SQL  -> ${path.relative(ROOT, SQL_OUT)}`);
console.log(`report -> ${path.relative(ROOT, REPORT_OUT)}`);
