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
  [k: string]: unknown;
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
  const pctList: number[] = [];

  for (const p of products) {
    if (!(typeof p.price === 'number') || p.price <= 0) { skippedPOA++; continue; } // POA
    if (!reroll && typeof p.originalPrice === 'number' && p.originalPrice > p.price) {
      skippedExisting++;
      continue;
    }
    const pct = MIN_PCT + Math.floor(Math.random() * (MAX_PCT - MIN_PCT + 1)); // 5..33
    p.originalPrice = fakeOriginal(p.price, pct);
    p.isSale = true;
    const realPct = Math.round((p.originalPrice - p.price) / p.originalPrice * 100);
    pctList.push(realPct);
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

  console.log(`apply-fake-discounts: applied=${applied} skipped(existing)=${skippedExisting} skipped(POA)=${skippedPOA}`);
  console.log(`apply-fake-discounts: displayed discount range this run: ${minPct}%..${maxPct}%`);
  console.log(`apply-fake-discounts: catalogue now shows ${onSale}/${afterArr.length} products on sale`);
  const sample = afterArr.find(p => typeof p.originalPrice === 'number');
  if (sample) {
    console.log(`apply-fake-discounts: sample #${sample.id} "${sample.name.trim()}" was $${sample.originalPrice} now $${sample.price}`);
  }
}

main();
