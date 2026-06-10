// Quick data-quality audit of the catalogue (item #5). Flags structural issues
// in every product — missing / too-short / placeholder / duplicated fields,
// $0 prices, missing images, thin tag sets — so they can be fixed before
// hashtags (#6) are added. Semantic correctness (does the copy actually match
// the product?) still needs human/web review; this only catches structural red
// flags fast.
//
//   npx tsx scripts/audit-product-data.ts
//
// Reads the bundled data/products.json (the catalogue seed). The live catalogue
// in Supabase Storage may differ slightly where admin edits have been made.

import fs from 'fs';
import path from 'path';

interface Product {
  id: number;
  name?: string;
  categoryId?: string;
  specification?: string;
  description?: string;
  indication?: string;
  packaging?: string;
  protocol?: string;
  price?: number;
  image?: string;
  tags?: string[];
}

const DATA = path.join(process.cwd(), 'data', 'products.json');
const products: Product[] = JSON.parse(fs.readFileSync(DATA, 'utf8')).products;

const MIN = { description: 40, indication: 15, protocol: 15, packaging: 5 };
const PLACEHOLDER = /lorem ipsum|\btodo\b|\btbd\b|placeholder|coming soon|^n\/?a$/i;

const blank = (s?: string) => !s || !s.trim();
const short = (s: string | undefined, n: number) => !blank(s) && (s as string).trim().length < n;

type Issue = { id: number; name: string; problem: string };
const issues: Issue[] = [];
const add = (p: Product, problem: string) => issues.push({ id: p.id, name: p.name ?? '(no name)', problem });

// Duplicate-description detection (templated copy shared across many products).
const descCount = new Map<string, number[]>();
const nameCount = new Map<string, number[]>();

for (const p of products) {
  if (blank(p.name)) add(p, 'name missing');
  if (blank(p.image)) add(p, 'image missing');
  if (p.price == null || p.price <= 0) add(p, `price is ${p.price ?? 'missing'}`);

  for (const field of ['description', 'indication', 'protocol', 'packaging'] as const) {
    const v = p[field];
    if (blank(v)) add(p, `${field} missing`);
    else if (short(v, MIN[field])) add(p, `${field} very short (${v!.trim().length} chars)`);
    else if (PLACEHOLDER.test(v!)) add(p, `${field} looks like placeholder text`);
  }

  const tagN = (p.tags ?? []).length;
  if (tagN < 6) add(p, `only ${tagN} tag(s) (#6 wants 6-15)`);

  if (!blank(p.description)) {
    const k = p.description!.trim();
    descCount.set(k, [...(descCount.get(k) ?? []), p.id]);
  }
  if (!blank(p.name)) {
    const k = p.name!.trim().toLowerCase();
    nameCount.set(k, [...(nameCount.get(k) ?? []), p.id]);
  }
}

const dupDesc = [...descCount.entries()].filter(([, ids]) => ids.length >= 3);
const dupName = [...nameCount.entries()].filter(([, ids]) => ids.length >= 2);

// ── Build report ────────────────────────────────────────────────────────────
const byProblem = new Map<string, Issue[]>();
for (const it of issues) {
  const key = it.problem.replace(/\(.*\)/, '').replace(/is .*/, 'bad value').trim();
  byProblem.set(key, [...(byProblem.get(key) ?? []), it]);
}

const lines: string[] = [];
lines.push('PRODUCT DATA AUDIT (#5) — structural quick-check');
lines.push(`Source: data/products.json · ${products.length} products`);
lines.push('');
lines.push('SUMMARY (issue → count of products):');
[...byProblem.entries()].sort((a, b) => b[1].length - a[1].length)
  .forEach(([k, list]) => lines.push(`  ${String(list.length).padStart(4)}  ${k}`));
lines.push(`  ${String(dupDesc.length).padStart(4)}  duplicate description shared by ≥3 products`);
lines.push(`  ${String(dupName.length).padStart(4)}  duplicate product name`);
lines.push('');
lines.push('DETAIL (first 40 per issue):');
for (const [k, list] of [...byProblem.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push('');
  lines.push(`### ${k} (${list.length})`);
  list.slice(0, 40).forEach(it => lines.push(`  #${it.id}  ${it.name} — ${it.problem}`));
  if (list.length > 40) lines.push(`  …and ${list.length - 40} more`);
}
if (dupDesc.length) {
  lines.push('');
  lines.push(`### duplicate descriptions (${dupDesc.length} groups)`);
  dupDesc.slice(0, 20).forEach(([, ids]) => lines.push(`  ids ${ids.join(', ')}`));
}

const OUT = path.join(process.cwd(), 'product-data-audit.txt');
fs.writeFileSync(OUT, lines.join('\n'), 'utf8');

// Console summary
console.log(`\nAudited ${products.length} products → ${issues.length} flags across ${byProblem.size} issue types.`);
console.log(`Duplicate descriptions: ${dupDesc.length} groups · duplicate names: ${dupName.length}`);
console.log(`Report written to ${OUT}\n`);
[...byProblem.entries()].sort((a, b) => b[1].length - a[1].length)
  .forEach(([k, list]) => console.log(`  ${String(list.length).padStart(4)}  ${k}`));
