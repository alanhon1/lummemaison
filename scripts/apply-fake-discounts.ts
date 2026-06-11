// Apply a fake "was/now" discount to every product in the LIVE catalogue.
//   npx tsx scripts/apply-fake-discounts.ts
//
// For each priced product we invent a higher `originalPrice` (the struck-through
// "was" price) so the product LOOKS discounted, and flag it `isSale`. The real
// selling `price` is NEVER changed — the customer still pays `price`; the
// cart/checkout/stock are untouched.
//
// The discount % is tied to price: cheaper items get a bigger % (up to 33%),
// premium items a smaller % (down to 5%), with a mild deterministic jitter so it's
// *mostly* — not rigidly — that trend. Products in the same section (groupId) share
// one %. The $0.5 random mask sheets are excluded (no fake discount).
//
// Deterministic & idempotent: percentages are computed from price + a hashed seed
// (no RNG), so re-running produces the same result and only rewrites what changed.
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

// Discount % is tied to price — cheaper items get a bigger %, premium items a
// smaller % — with a mild deterministic jitter so it's *mostly* (not rigidly) that
// trend. PRICE_LOW/HIGH bound the log-scale mapping band.
const PRICE_LOW = 10;    // <= this → ~MAX_PCT off
const PRICE_HIGH = 250;  // >= this → ~MIN_PCT off

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  isSale?: boolean;
  groupId?: string;
  [k: string]: unknown;
}

// Excluded from any fake discount: the $0.5 random face mask sheets.
function isExcluded(p: Product): boolean {
  return /mask\s*sheets?/i.test(p.name) && p.price <= 1;
}

// Inverse-price percent on a log scale (so the $10–$250 bulk spreads evenly),
// clamped to [MIN_PCT, MAX_PCT]. No jitter here.
function basePct(price: number): number {
  const t = Math.min(1, Math.max(0,
    (Math.log(price) - Math.log(PRICE_LOW)) / (Math.log(PRICE_HIGH) - Math.log(PRICE_LOW))));
  return MAX_PCT - t * (MAX_PCT - MIN_PCT);
}
// Deterministic ±J jitter from a seed string → stable across runs (idempotent).
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function jitter(seed: string, J = 4): number {
  return (hashStr(seed) % (2 * J + 1)) - J;
}
function clampPct(x: number): number {
  return Math.min(MAX_PCT, Math.max(MIN_PCT, Math.round(x)));
}
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
  let skippedSame = 0;
  let skippedPOA = 0;
  let excludedCleared = 0;
  const pctList: number[] = [];

  // 0. Strip any fake discount off excluded items (the $0.5 mask sheets).
  for (const p of products) {
    if (isExcluded(p)) {
      if (typeof p.originalPrice === 'number') { delete p.originalPrice; excludedCleared++; }
      p.isSale = false;
    }
  }

  // 1. One % per group (same section → same %), from the group's MEDIAN price so
  //    the whole line shares a single inverse-price discount.
  const byGroup = new Map<string, Product[]>();
  for (const p of products) {
    if (typeof p.groupId === 'string' && p.groupId && p.price > 0 && !isExcluded(p)) {
      const list = byGroup.get(p.groupId) ?? [];
      list.push(p);
      byGroup.set(p.groupId, list);
    }
  }
  const groupPct = new Map<string, number>();
  for (const [gid, members] of byGroup) {
    groupPct.set(gid, clampPct(basePct(median(members.map(m => m.price))) + jitter(gid)));
  }

  // 2. Apply. Target %: the group's shared %, else the product's own price-based %.
  for (const p of products) {
    if (isExcluded(p)) continue;
    if (!(typeof p.price === 'number') || p.price <= 0) { skippedPOA++; continue; } // POA
    const gid = typeof p.groupId === 'string' ? p.groupId : '';
    const target = gid ? groupPct.get(gid)! : clampPct(basePct(p.price) + jitter('p' + p.id));
    if (typeof p.originalPrice === 'number' && impliedPct(p) === target) {
      skippedSame++;
      continue;
    }
    p.originalPrice = fakeOriginal(p.price, target);
    p.isSale = true;
    pctList.push(Math.round((p.originalPrice - p.price) / p.originalPrice * 100));
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

  console.log(`apply-fake-discounts: applied=${applied} skipped(same)=${skippedSame} skipped(POA)=${skippedPOA} excluded-cleared=${excludedCleared}`);
  console.log(`apply-fake-discounts: displayed discount range this run: ${minPct}%..${maxPct}%`);
  console.log(`apply-fake-discounts: catalogue now shows ${onSale}/${afterArr.length} products on sale`);
  console.log(`apply-fake-discounts: groups with mismatched %: ${inconsistent.length}${inconsistent.length ? ' -> ' + inconsistent.map(([g, s]) => `${g}(${[...s].join('/')})`).join(', ') : ''}`);
  const sample = afterArr.find(p => typeof p.originalPrice === 'number');
  if (sample) {
    console.log(`apply-fake-discounts: sample #${sample.id} "${sample.name.trim()}" was $${sample.originalPrice} now $${sample.price}`);
  }
}

main();
