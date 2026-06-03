// One-shot: seed public.product_stock from SG_STOCK_MAY.qty.xlsx.
//
//   npm run seed:stock:csv
//
// Reads the visible sheet "STOCK_M (2)" (the hidden "STOCK_M" sheet is a noisy
// master/lookup — ignored). For each row, takes column B = product name,
// column C = qty. Normalizes both sides (UPPER + trim + collapse whitespace)
// and matches exactly against data/products.json. Matched rows are upserted
// with their qty (including 0 = explicit sold out). Catalogue products absent
// from the xlsx get a default of 999 so they don't render as sold out.
// xlsx names that don't map to any catalogue product are reported, never seeded.
//
// Idempotent — re-running with the same source leaves row counts unchanged and
// only bumps updated_at via the table trigger.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { STOCK_ALIASES } from './stock-aliases';

function loadDotEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv('.env.local');
loadDotEnv('.env');

const XLSX_PATH = 'SG_STOCK_MAY.qty.xlsx';
const SHEET_NAME = 'STOCK_M (2)';
const PRODUCTS_JSON = 'data/products.json';
const DEFAULT_STOCK = 999;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalize(s: string): string {
  return s.toUpperCase().trim().replace(/\s+/g, ' ');
}

type Product = { id: number; name: string };

type Catalogue = {
  // Unique normalized name -> the single product with that name.
  unique: Map<string, Product>;
  // Normalized names that appear on 2+ products — too ambiguous to safely
  // assign an xlsx qty to. We still seed them (with the 999 default) so they
  // don't render as sold out, but xlsx matches against these are reported,
  // not applied.
  ambiguous: Map<string, Product[]>;
  // All products kept around for the default-pass.
  all: Product[];
};

function loadCatalogue(): Catalogue {
  const raw = readFileSync(resolve(process.cwd(), PRODUCTS_JSON), 'utf8');
  const json = JSON.parse(raw) as { products: Product[] };
  const byKey = new Map<string, Product[]>();
  const all: Product[] = [];
  for (const p of json.products) {
    if (typeof p.id !== 'number' || typeof p.name !== 'string') continue;
    all.push({ id: p.id, name: p.name });
    const key = normalize(p.name);
    const list = byKey.get(key);
    if (list) list.push(p);
    else byKey.set(key, [{ id: p.id, name: p.name }]);
  }
  const unique = new Map<string, Product>();
  const ambiguous = new Map<string, Product[]>();
  for (const [k, list] of byKey) {
    if (list.length === 1) unique.set(k, list[0]);
    else ambiguous.set(k, list);
  }
  return { unique, ambiguous, all };
}

type XlsxRow = { rawName: string; qty: number };

function loadXlsx(): { rows: XlsxRow[]; invalid: Array<{ rawName: string; rawQty: unknown }> } {
  if (!existsSync(resolve(process.cwd(), XLSX_PATH))) {
    console.error(`Source file not found: ${XLSX_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`Sheet "${SHEET_NAME}" not found. Available: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  // header:1 → array-of-arrays, defval: undefined so empty cells stay undefined
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: undefined, blankrows: false });
  const rows: XlsxRow[] = [];
  const invalid: Array<{ rawName: string; rawQty: unknown }> = [];
  // Row 0 is header (C1="qty"). Skip it.
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    // Column B = index 1, Column C = index 2.
    const nameCell = row[1];
    const qtyCell = row[2];
    if (nameCell === undefined || nameCell === null) continue;
    const rawName = String(nameCell).trim();
    if (!rawName) continue;
    if (qtyCell === undefined || qtyCell === null || qtyCell === '') {
      invalid.push({ rawName, rawQty: qtyCell });
      continue;
    }
    const qtyNum = typeof qtyCell === 'number' ? qtyCell : Number(String(qtyCell).trim());
    if (!Number.isFinite(qtyNum) || !Number.isInteger(qtyNum) || qtyNum < 0) {
      invalid.push({ rawName, rawQty: qtyCell });
      continue;
    }
    rows.push({ rawName, qty: qtyNum });
  }
  return { rows, invalid };
}

function validateAliases(catalogue: Catalogue) {
  const ids = new Set(catalogue.all.map(p => p.id));
  const badKeys: string[] = [];
  const badTargets: Array<{ key: string; id: number }> = [];
  for (const [key, id] of Object.entries(STOCK_ALIASES)) {
    if (normalize(key) !== key) badKeys.push(key);
    if (!ids.has(id)) badTargets.push({ key, id });
  }
  if (badKeys.length > 0) {
    console.error('Alias keys must be pre-normalized (UPPER + trim + single space):');
    for (const k of badKeys) console.error(`  "${k}" → expected "${normalize(k)}"`);
    process.exit(1);
  }
  if (badTargets.length > 0) {
    console.error('Alias targets reference unknown product ids:');
    for (const b of badTargets) console.error(`  "${b.key}" → id ${b.id} (not in data/products.json)`);
    process.exit(1);
  }
}

async function main() {
  const catalogue = loadCatalogue();
  console.log(
    `Loaded ${catalogue.all.length} catalogue products ` +
      `(${catalogue.unique.size} unique normalized names, ${catalogue.ambiguous.size} ambiguous).`,
  );

  validateAliases(catalogue);
  console.log(`Loaded ${Object.keys(STOCK_ALIASES).length} manual aliases.`);

  const { rows, invalid } = loadXlsx();
  console.log(`Loaded ${rows.length} xlsx rows from sheet "${SHEET_NAME}".`);

  // Build xlsx map, detect collisions after normalization.
  const xlsxMap = new Map<string, { rawName: string; qty: number }>();
  const collisions: Array<{ key: string; a: { rawName: string; qty: number }; b: { rawName: string; qty: number } }> = [];
  for (const r of rows) {
    const key = normalize(r.rawName);
    const existing = xlsxMap.get(key);
    if (existing) {
      collisions.push({ key, a: existing, b: r });
    } else {
      xlsxMap.set(key, r);
    }
  }
  if (collisions.length > 0) {
    console.error(`\nCollision: ${collisions.length} pair(s) of xlsx rows normalize to the same name. Aborting (no write).`);
    for (const c of collisions) {
      console.error(`  "${c.key}" — first "${c.a.rawName}" qty=${c.a.qty}, second "${c.b.rawName}" qty=${c.b.qty}`);
    }
    process.exit(1);
  }

  // Match xlsx → catalogue.
  // Resolution order per xlsx row:
  //   1. STOCK_ALIASES — manual mapping for known formatting/name diffs.
  //   2. catalogue.unique — exact normalized-name match.
  //   3. catalogue.ambiguous — matches a duplicate-name group, can't disambiguate.
  //   4. otherwise → unmatched.
  // After resolution, if two xlsx rows landed on the same product_id (e.g. an
  // alias mapping + a direct match both point at id 100), abort — the upsert
  // would otherwise silently last-wins.
  const matched: Array<{ product_id: number; stock: number; rawName: string; via: 'alias' | 'unique' }> = [];
  const xlsxHitAmbiguous: Array<{ key: string; rawName: string; qty: number; productIds: number[] }> = [];
  const unmatchedFromXlsx: string[] = [];
  const matchedByProductId = new Map<number, { rawName: string; via: 'alias' | 'unique' }>();
  const productIdCollisions: Array<{ id: number; a: { rawName: string; via: string }; b: { rawName: string; via: string } }> = [];
  let aliasMatchCount = 0;
  for (const [key, entry] of xlsxMap) {
    let productId: number | undefined;
    let via: 'alias' | 'unique' | undefined;
    const aliasId = STOCK_ALIASES[key];
    if (aliasId !== undefined) {
      productId = aliasId;
      via = 'alias';
      aliasMatchCount++;
    } else {
      const unique = catalogue.unique.get(key);
      if (unique) {
        productId = unique.id;
        via = 'unique';
      }
    }
    if (productId !== undefined && via !== undefined) {
      const existing = matchedByProductId.get(productId);
      if (existing) {
        productIdCollisions.push({ id: productId, a: existing, b: { rawName: entry.rawName, via } });
        continue;
      }
      matchedByProductId.set(productId, { rawName: entry.rawName, via });
      matched.push({ product_id: productId, stock: entry.qty, rawName: entry.rawName, via });
      continue;
    }
    const ambig = catalogue.ambiguous.get(key);
    if (ambig) {
      xlsxHitAmbiguous.push({ key, rawName: entry.rawName, qty: entry.qty, productIds: ambig.map(p => p.id) });
      continue;
    }
    unmatchedFromXlsx.push(entry.rawName);
  }
  if (productIdCollisions.length > 0) {
    console.error(`\nCollision: ${productIdCollisions.length} pair(s) of xlsx rows resolved to the same product_id. Aborting (no write).`);
    for (const c of productIdCollisions) {
      console.error(`  id ${c.id} — first "${c.a.rawName}" (${c.a.via}), second "${c.b.rawName}" (${c.b.via})`);
    }
    process.exit(1);
  }

  // Default pass: every catalogue product whose id was not in `matched`
  // gets the 999 default. This includes ALL products in ambiguous groups,
  // even when the xlsx had a row that fuzzy-could-have-matched them.
  const matchedIds = new Set(matched.map(m => m.product_id));
  const defaults: Array<{ product_id: number; stock: number }> = [];
  for (const p of catalogue.all) {
    if (!matchedIds.has(p.id)) {
      defaults.push({ product_id: p.id, stock: DEFAULT_STOCK });
    }
  }

  const payload = [
    ...matched.map(m => ({ product_id: m.product_id, stock: m.stock })),
    ...defaults,
  ];

  // Summary first so the user can read it even if the upsert fails.
  console.log('\n=== Summary ===');
  console.log(`matched (from xlsx):                ${matched.length} (alias=${aliasMatchCount}, direct=${matched.length - aliasMatchCount})`);
  console.log(`default(${DEFAULT_STOCK}) applied:                ${defaults.length}`);
  console.log(`invalid xlsx rows (bad qty):        ${invalid.length}`);
  if (invalid.length > 0) {
    for (const x of invalid) {
      console.log(`  - "${x.rawName}" (qty cell: ${JSON.stringify(x.rawQty)})`);
    }
  }
  console.log(`xlsx hit ambiguous catalogue group: ${xlsxHitAmbiguous.length}`);
  if (xlsxHitAmbiguous.length > 0) {
    console.log('  (xlsx qty NOT applied — multiple catalogue products share this name; defaulted to 999 instead)');
    for (const a of xlsxHitAmbiguous) {
      console.log(`  - "${a.rawName}" qty=${a.qty} → ids [${a.productIds.join(', ')}]`);
    }
  }
  console.log(`unmatched xlsx names:               ${unmatchedFromXlsx.length}`);
  for (const n of unmatchedFromXlsx) {
    console.log(`  - ${n}`);
  }

  console.log(`\nUpserting ${payload.length} rows into product_stock…`);
  const { error } = await supabase
    .from('product_stock')
    .upsert(payload, { onConflict: 'product_id' });
  if (error) {
    console.error('Upsert failed:', error.message);
    process.exit(1);
  }
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
