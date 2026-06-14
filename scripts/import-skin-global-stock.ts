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

// SQL single-quote a string literal (escape embedded quotes).
const sq = (s: string) => `'${String(s).replace(/'/g, "''")}'`;

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
// Character-bigram Dice coefficient (0..1) for typo/compound-word tolerance,
// so 1-letter differences (MAXIBLUE↔MAXYBLUE) and merges (MULTI VITA↔
// Multivitamin) still surface as candidates.
function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}
function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const A = bigrams(a);
  const counts = new Map<string, number>();
  for (const g of bigrams(b)) counts.set(g, (counts.get(g) ?? 0) + 1);
  let inter = 0;
  for (const g of A) { const c = counts.get(g); if (c) { inter++; counts.set(g, c - 1); } }
  return (2 * inter) / (A.length + bigrams(b).length);
}
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

const mapJson = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
// A mapping value is either an id (number; option '') or { id, option }.
// id 0 = skip (not on site), id -1 = wonder list (no site id).
type MapVal = number | { id: number; option?: string };
const manual = mapJson.mappings as Record<string, MapVal>;
const resolveMap = (v: MapVal): { id: number; option: string } =>
  typeof v === 'number' ? { id: v, option: '' } : { id: v.id, option: v.option ?? '' };
// Site (product, option) the owner explicitly marked WONDER (unknown stock).
const wonderProductIds: number[] = mapJson.wonderProductIds ?? [];
const wonderOptions: Array<{ id: number; option?: string }> = mapJson.wonderOptions ?? [];

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

const matched: { name: string; qty: number; id: number; option: string; how: string }[] = [];
const skipped: string[] = [];
const wonderList: { name: string; qty: number }[] = [];
const report: { name: string; qty: number; candidates: Prod[] }[] = [];

for (const it of xlsxItems) {
  if (Object.prototype.hasOwnProperty.call(manual, it.name)) {
    const { id, option } = resolveMap(manual[it.name]);
    if (id === 0) { skipped.push(it.name); continue; }
    if (id === -1) { wonderList.push({ name: it.name, qty: it.qty }); continue; }
    matched.push({ name: it.name, qty: it.qty, id, option, how: 'manual' });
    continue;
  }
  const exact = byExact.get(it.name.toUpperCase());
  if (exact) { matched.push({ name: it.name, qty: it.qty, id: exact.id, option: '', how: 'exact' }); continue; }
  const n = byNorm.get(norm(it.name));
  if (n && n.length === 1) { matched.push({ name: it.name, qty: it.qty, id: n[0].id, option: '', how: 'normalized' }); continue; }
  // Fuzzy core: if exactly one site product shares the volume/variant-stripped
  // core, auto-accept it (flagged 'core' so the owner can skim these).
  const c = byCore.get(core(it.name));
  if (c && c.length === 1) { matched.push({ name: it.name, qty: it.qty, id: c[0].id, option: '', how: 'core' }); continue; }
  // ambiguous or unmatched → suggest candidates. Prefer core/normalized hits;
  // otherwise score all products by shared significant name tokens (top 4).
  let cands = (c ?? n ?? []).slice(0, 6);
  if (cands.length === 0) {
    const itTokens = tokens(it.name);
    const first = itTokens[0];
    const itNorm = norm(it.name);
    cands = products
      .map(p => {
        const pt = tokens(p.name);
        let score = pt.filter(t => itTokens.includes(t)).length;
        if (first && pt[0] === first) score += 2; // same leading brand/word
        score += dice(itNorm, norm(p.name)) * 4; // typo / compound-word similarity
        return { p, score };
      })
      .filter(x => x.score > 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.p);
  }
  report.push({ name: it.name, qty: it.qty, candidates: cands });
}

// Collision guard: if two different xlsx items resolved to the same site
// product, keep only the highest-confidence one (manual > exact > normalized >
// core) and push the rest to the report so the owner can confirm whether they
// are the same product (combine) or a separate SKU (skip).
const prodById = new Map(products.map(p => [p.id, p]));
const rank: Record<string, number> = { manual: 0, exact: 1, normalized: 2, core: 3 };
// Key by (product_id, option): different options of one product are distinct.
const bestByKey = new Map<string, typeof matched[number]>();
const collisions: typeof matched = [];
for (const m of matched) {
  const key = `${m.id}::${m.option}`;
  const cur = bestByKey.get(key);
  if (!cur) { bestByKey.set(key, { ...m }); continue; }
  if (rank[m.how] < rank[cur.how]) { collisions.push(cur); bestByKey.set(key, { ...m }); }
  else { collisions.push(m); }
}
const finalMatched = [...bestByKey.values()];
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
    `insert into public.product_stock (product_id, option, stock, stock_unknown) values (${m.id}, ${sq(m.option)}, ${m.qty}, false) ` +
    `on conflict (product_id, option) do update set stock = excluded.stock, stock_unknown = false; -- ${m.name} [${m.how}]`),
  '',
  ...(wonderProductIds.length || wonderOptions.length ? ['-- Owner-marked WONDER (unknown stock / ???).'] : []),
  ...wonderProductIds.map(id =>
    `insert into public.product_stock (product_id, option, stock, wonder, stock_unknown) values (${id}, '', 0, true, true) ` +
    `on conflict (product_id, option) do update set wonder = true, stock_unknown = true; -- #${id} ${prodById.get(id)?.name ?? '?'}`),
  ...wonderOptions.map(w =>
    `insert into public.product_stock (product_id, option, stock, wonder, stock_unknown) values (${w.id}, ${sq(w.option ?? '')}, 0, true, true) ` +
    `on conflict (product_id, option) do update set wonder = true, stock_unknown = true; -- #${w.id} (${w.option ?? ''}) ${prodById.get(w.id)?.name ?? '?'}`),
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
  `- Marked WONDER (no number; toggle in admin after deploy): **${wonderList.length}**`,
  `- Needs your decision: **${report.length}**`,
  '',
  ...(wonderList.length ? ['## Marked WONDER', ...wonderList.map(w => `- ${w.name} (qty ${w.qty})`), ''] : []),
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
