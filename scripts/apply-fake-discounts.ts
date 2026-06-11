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
// *mostly* — not rigidly — that trend. Within a section (groupId), items priced
// within $1 of each other share ONE "was" price (so near-identical variants look
// uniform; their displayed % differs slightly as the now-price differs). The $0.5
// random mask sheets are excluded (no fake discount).
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
const PRICE_HIGH = 120;  // >= this → ~MIN_PCT off
const CLUSTER_SPAN = 1;  // same section, prices within $1 → share one "was" price

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

// Pre-discount "was" price = price / (1 - d), rounded UP to the cent. Rounding to
// the cent keeps the DISPLAYED percent — round((was-price)/was*100) — equal to the
// chosen pct, so it never drifts outside the 5%–33% band (a "nice" .99 snap could
// push a cheap item to ~50% off, which we must not do). Always strictly > price.
function fakeOriginal(price: number, pct: number): number {
  const was = Math.ceil((price / (1 - pct / 100)) * 100) / 100;
  return was > price ? was : Math.round((price + 0.01) * 100) / 100;
}

// Snap a raw "was" price to an attractive retail ending (.49 or .99) — the nearest
// such value that stays above `maxPrice` (every cluster member keeps a discount)
// and doesn't push the cheapest member's % over the cap.
function niceWas(rawWas: number, minPrice: number, maxPrice: number): number {
  const base = Math.floor(rawWas);
  const cands: number[] = [];
  for (let k = base - 1; k <= base + 2; k++) cands.push(k + 0.49, k + 0.99);
  const aboveFloor = cands.filter(c => c > maxPrice + 1e-9);
  const ok = aboveFloor.filter(c => (c - minPrice) / c * 100 <= MAX_PCT + 0.4);
  const pool = (ok.length ? ok : aboveFloor).sort((a, b) => Math.abs(a - rawWas) - Math.abs(b - rawWas));
  return pool.length ? Math.round(pool[0] * 100) / 100 : Math.round((maxPrice + 0.49) * 100) / 100;
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

  // 1. Build clusters: within a section (groupId), members whose prices fall within
  //    CLUSTER_SPAN ($1) of the cluster's cheapest item share ONE "was" price, so
  //    e.g. ELASTY $13/$13/$13 (or SOSUM $37/$38/$38) get an identical original.
  //    Pricier siblings of the same line (SOSUM $106) fall into their own cluster
  //    and keep a smaller discount. Standalone products are singleton clusters.
  const clusters: { seed: string; members: Product[] }[] = [];
  const bySection = new Map<string, Product[]>();
  for (const p of products) {
    if (isExcluded(p) || !(typeof p.price === 'number') || p.price <= 0) continue;
    if (typeof p.groupId === 'string' && p.groupId) {
      const list = bySection.get(p.groupId) ?? [];
      list.push(p);
      bySection.set(p.groupId, list);
    } else {
      clusters.push({ seed: `p${p.id}`, members: [p] }); // standalone
    }
  }
  for (const [gid, members] of bySection) {
    members.sort((a, b) => a.price - b.price);
    let cur: Product[] = [];
    let idx = 0;
    for (const m of members) {
      // Single-linkage on the sorted prices: a new item joins while it's within
      // $1 of the PREVIOUS one. This guarantees the invariant "any two items in a
      // section within $1 share a cluster (and thus one 'was' price)".
      if (cur.length === 0 || m.price - cur[cur.length - 1].price <= CLUSTER_SPAN) {
        cur.push(m);
      } else {
        clusters.push({ seed: `${gid}#${idx++}`, members: cur });
        cur = [m];
      }
    }
    if (cur.length) clusters.push({ seed: `${gid}#${idx}`, members: cur });
  }

  // 2. One "was" price per cluster: from the cheapest member's inverse-price % (so
  //    its displayed discount stays the largest and within the cap). Pricier members
  //    of the cluster show a slightly smaller % off the same "was". Guard so the
  //    shared "was" stays above every member's price.
  for (const { seed, members } of clusters) {
    const minPrice = members[0].price;
    const maxPrice = members[members.length - 1].price;
    const target = clampPct(basePct(minPrice) + jitter(seed));
    const was = niceWas(fakeOriginal(minPrice, target), minPrice, maxPrice);
    for (const p of members) {
      if (typeof p.originalPrice === 'number' && p.originalPrice === was) { skippedSame++; continue; }
      p.originalPrice = was;
      p.isSale = true;
      pctList.push(Math.round((was - p.price) / was * 100));
      applied++;
    }
  }
  // POA / excluded already counted by being skipped above.
  skippedPOA = products.filter(p => typeof p.price === 'number' && p.price <= 0).length;

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

  // Sanity check the invariant: in a section, any two items priced within $1 must
  // share the same "was" price. Count violating pairs (should be 0).
  const sections = new Map<string, Product[]>();
  for (const p of afterArr) {
    if (typeof p.groupId === 'string' && p.groupId && typeof p.originalPrice === 'number') {
      const l = sections.get(p.groupId) ?? [];
      l.push(p);
      sections.set(p.groupId, l);
    }
  }
  let violations = 0;
  for (const [, members] of sections) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (Math.abs(members[i].price - members[j].price) <= CLUSTER_SPAN &&
            members[i].originalPrice !== members[j].originalPrice) {
          violations++;
        }
      }
    }
  }

  console.log(`apply-fake-discounts: applied=${applied} skipped(same)=${skippedSame} skipped(POA)=${skippedPOA} excluded-cleared=${excludedCleared}`);
  console.log(`apply-fake-discounts: displayed discount range this run: ${minPct}%..${maxPct}%`);
  console.log(`apply-fake-discounts: catalogue now shows ${onSale}/${afterArr.length} products on sale`);
  console.log(`apply-fake-discounts: within-$1 same-section "was" mismatches: ${violations}`);
  const sample = afterArr.find(p => typeof p.originalPrice === 'number');
  if (sample) {
    console.log(`apply-fake-discounts: sample #${sample.id} "${sample.name.trim()}" was $${sample.originalPrice} now $${sample.price}`);
  }
}

main();
