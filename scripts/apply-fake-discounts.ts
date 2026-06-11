// Apply a fake "was/now" discount to every product in the LIVE catalogue.
//   npx tsx scripts/apply-fake-discounts.ts
//
// For each priced product we invent a higher `originalPrice` (the struck-through
// "was" price) so the product LOOKS discounted by a random 5%–33%, and flag it
// `isSale`. The real selling `price` is NEVER changed — the customer still pays
// `price`; the cart/checkout/stock are untouched.
//
// Idempotent: a product that already has `originalPrice` is left alone, so
// re-running never re-rolls the discount. Pass `--reroll` to regenerate all.
//
// Reads env from `.env.local` (same as seed-catalogue.ts). Operates on the live
// Supabase Storage object `catalogue/products.json`, which is the source of
// truth — the bundled data/products.json is only a stale seed and is NOT touched.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

const BUCKET = 'catalogue';
const OBJECT = 'products.json';
const MIN_PCT = 5;
const MAX_PCT = 33;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const reroll = process.argv.includes('--reroll');

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  isSale?: boolean;
  groupId?: string;
  [k: string]: unknown;
}

function randPct(): number {
  return MIN_PCT + Math.floor(Math.random() * (MAX_PCT - MIN_PCT + 1)); // 5..33
}

// The discount % currently implied by a product's stored originalPrice, or 0.
function impliedPct(p: Product): number {
  const o = p.originalPrice;
  if (typeof o === 'number' && o > p.price && p.price > 0) {
    return Math.round((o - p.price) / o * 100);
  }
  return 0;
}

// Pre-discount "was" price = price / (1 - d), rounded UP to the cent. Rounding to
// the cent keeps the DISPLAYED percent — round((was-price)/was*100) — equal to the
// chosen pct, so it never drifts outside the 5%–33% band (a "nice" .99 snap could
// push a cheap item to ~50% off, which we must not do). Always strictly > price.
function fakeOriginal(price: number, pct: number): number {
  const was = Math.ceil((price / (1 - pct / 100)) * 100) / 100;
  return was > price ? was : Math.round((price + 0.01) * 100) / 100;
}

async function main() {
  const supabase = createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(OBJECT);
  if (dlErr || !blob) {
    console.error('Download failed:', dlErr?.message);
    process.exit(1);
  }
  const parsed = JSON.parse(await blob.text());
  const products: Product[] = Array.isArray(parsed) ? parsed : parsed.products;
  if (!Array.isArray(products)) {
    console.error('Unexpected catalogue shape.');
    process.exit(1);
  }

  let applied = 0;
  let skippedExisting = 0;
  let skippedPOA = 0;
  let healed = 0;
  const pctList: number[] = [];

  // Same section (same groupId) → same discount %, so variants like ELASTY
  // FINE/DEEP/GRAND never show mismatched percents. One pct is chosen per group:
  // on a plain run we keep the % already on the group's lowest-id member (stable,
  // minimal churn) and only realign the others; --reroll picks a fresh group %.
  const byGroup = new Map<string, Product[]>();
  for (const p of products) {
    if (typeof p.groupId === 'string' && p.groupId) {
      const list = byGroup.get(p.groupId) ?? [];
      list.push(p);
      byGroup.set(p.groupId, list);
    }
  }
  const groupPct = new Map<string, number>();
  for (const [gid, members] of byGroup) {
    let pct = 0;
    if (!reroll) {
      const existing = members.filter(m => impliedPct(m) > 0).sort((a, b) => a.id - b.id);
      if (existing.length) pct = impliedPct(existing[0]);
    }
    groupPct.set(gid, pct || randPct());
  }

  for (const p of products) {
    if (!(typeof p.price === 'number') || p.price <= 0) { skippedPOA++; continue; } // POA
    const gid = typeof p.groupId === 'string' ? p.groupId : '';
    // Target % for this product: its group's shared %, else its own existing % (plain
    // run) or a fresh random one.
    const target = gid ? groupPct.get(gid)! : (!reroll && impliedPct(p) > 0 ? impliedPct(p) : randPct());
    // Already correct on a plain run → leave it untouched.
    if (!reroll && typeof p.originalPrice === 'number' && impliedPct(p) === target) {
      skippedExisting++;
      continue;
    }
    const wasInconsistent = gid && !reroll && typeof p.originalPrice === 'number';
    p.originalPrice = fakeOriginal(p.price, target);
    p.isSale = true;
    pctList.push(Math.round((p.originalPrice - p.price) / p.originalPrice * 100));
    if (wasInconsistent) healed++;
    applied++;
  }

  // Upload (preserve the { products } wrapper shape used by the store).
  const out = Array.isArray(parsed) ? products : { ...parsed, products };
  const body = Buffer.from(JSON.stringify(out, null, 2), 'utf8');
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (upErr) {
    console.error('Upload failed:', upErr.message);
    process.exit(1);
  }

  // Verify + report.
  const { data: v } = await supabase.storage.from(BUCKET).download(OBJECT);
  const after = JSON.parse(await v!.text());
  const afterArr: Product[] = Array.isArray(after) ? after : after.products;
  const onSale = afterArr.filter(p => typeof p.originalPrice === 'number' && p.originalPrice > p.price).length;
  const minPct = pctList.length ? Math.min(...pctList) : 0;
  const maxPct = pctList.length ? Math.max(...pctList) : 0;

  // Sanity check: every group must now show a single discount %.
  const afterGroups = new Map<string, Set<number>>();
  for (const p of afterArr) {
    if (typeof p.groupId === 'string' && p.groupId && impliedPct(p) > 0) {
      const s = afterGroups.get(p.groupId) ?? new Set<number>();
      s.add(impliedPct(p));
      afterGroups.set(p.groupId, s);
    }
  }
  const inconsistent = [...afterGroups.entries()].filter(([, s]) => s.size > 1);

  console.log(`apply-fake-discounts: applied=${applied} (healed=${healed}) skipped(existing)=${skippedExisting} skipped(POA)=${skippedPOA}`);
  console.log(`apply-fake-discounts: displayed discount range this run: ${minPct}%..${maxPct}%`);
  console.log(`apply-fake-discounts: catalogue now shows ${onSale}/${afterArr.length} products on sale`);
  console.log(`apply-fake-discounts: groups with mismatched %: ${inconsistent.length}${inconsistent.length ? ' -> ' + inconsistent.map(([g, s]) => `${g}(${[...s].join('/')})`).join(', ') : ''}`);
  const sample = afterArr.find(p => typeof p.originalPrice === 'number');
  if (sample) {
    console.log(`apply-fake-discounts: sample #${sample.id} "${sample.name.trim()}" was $${sample.originalPrice} now $${sample.price}`);
  }
}

main();
