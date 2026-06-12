// Adds the RED Mono/Screw/Twin items from "NeoGenesis PDO Product List (USD).pdf"
// to the live catalogue, grouped into 3 bundles (one per type), priced per type.
//
//   npx tsx scripts/add-neogenesis-pdo.ts            # preview (no writes)
//   npx tsx scripts/add-neogenesis-pdo.ts --apply    # write to live catalogue
//
// - Red detection: walks the PDF operator list and keeps text drawn in #ff0000.
// - Scope: Mono (M####), Screw (S####), Twin (T#### — not TR/TS/TF). Other red
//   types in the PDF are intentionally skipped (client asked for these 3).
// - Idempotent: skips any model code already present (by product name), so it's
//   safe to re-run. Prices: Mono $15, Screw $20, Twin $29.
// - Each type becomes one group (neo-pdo-mono/screw/twin); variants share the
//   group's image. Images are left blank here — set one image per group in admin
//   (or pass them later); everything else is filled.
// - After --apply it busts the live catalogue cache (REVALIDATE_SECRET).

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadDotEnv('.env.local');
loadDotEnv('.env');

const FILE = 'NeoGenesis PDO Product List (USD).pdf';
const BUCKET = 'catalogue';
const OBJECT = 'products.json';
const CATEGORY = 'nano-needle-cannula';
const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing Supabase env.'); process.exit(1); }

type Type = 'Mono' | 'Screw' | 'Twin';
const PRICE: Record<Type, number> = { Mono: 15, Screw: 20, Twin: 29 };

// Section photos extracted from the PDF, processed onto a white background and
// uploaded to the public product-images bucket (see neogenesis-upload-images.mjs).
// All variants in a type share the section image.
const IMAGE: Record<Type, string> = {
  Mono: 'https://axamhqgapwguurisgvvi.supabase.co/storage/v1/object/public/product-images/neo-pdo/mono-1.webp',
  Screw: 'https://axamhqgapwguurisgvvi.supabase.co/storage/v1/object/public/product-images/neo-pdo/screw-1.webp',
  Twin: 'https://axamhqgapwguurisgvvi.supabase.co/storage/v1/object/public/product-images/neo-pdo/twin-1.webp',
};

function typeOf(code: string): Type | null {
  const c = code.toUpperCase();
  if (/^M\d/.test(c)) return 'Mono';
  if (/^S\d/.test(c)) return 'Screw';
  if (/^T\d/.test(c)) return 'Twin'; // T#### only; TR/TS/TF won't match \d after the letter
  return null;
}
const isCode = (s: string) => /^[A-Z]{1,3}\d[\w-]*(\s*\([\d-]+\))?$/.test(s.trim());

function redLike(h: unknown): boolean {
  if (typeof h !== 'string') return false;
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (s.length !== 6) return false;
  const r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
  return r > 140 && g < 110 && b < 110;
}

async function extractRed(): Promise<Array<{ code: string; spec: string; type: Type }>> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const OPS = pdfjs.OPS;
  const data = new Uint8Array(readFileSync(FILE));
  const doc = await pdfjs.getDocument({ data }).promise;
  const runs: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const ol = await page.getOperatorList();
    let fill = '#000000';
    for (let k = 0; k < ol.fnArray.length; k++) {
      const fn = ol.fnArray[k], args = ol.argsArray[k];
      if (fn === OPS.setFillRGBColor) fill = Array.isArray(args) ? args[0] : args;
      else if (fn === OPS.showText || fn === OPS.showSpacedText) {
        let s = '';
        for (const g of (args[0] || [])) {
          if (typeof g === 'number') { if (g < -150) s += ' '; continue; }
          if (g && typeof g.unicode === 'string') s += g.unicode;
        }
        s = s.replace(/\s+/g, ' ').trim();
        if (s && redLike(fill)) runs.push(s);
      }
    }
  }
  const items: Array<{ code: string; spec: string; type: Type }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < runs.length; i++) {
    if (!isCode(runs[i])) continue;
    const code = runs[i].trim();
    const t = typeOf(code);
    if (!t || seen.has(code)) continue;
    const spec = i > 0 && !isCode(runs[i - 1]) ? runs[i - 1].trim() : '';
    seen.add(code);
    items.push({ code, spec, type: t });
  }
  return items;
}

function buildProduct(it: { code: string; spec: string; type: Type }, id: number) {
  const slug = it.type.toLowerCase();
  return {
    id,
    name: it.code,
    categoryId: CATEGORY,
    specification: it.spec,
    description: `NeoGenesis PDO ${it.type} thread. ${it.spec}. Sterile, single-use absorbable PDO (polydioxanone) thread.`,
    price: PRICE[it.type],
    tags: ['pdo', 'thread', slug, 'neogenesis'],
    isNew: false,
    isSale: false,
    isBestSeller: false,
    inStock: true,
    image: IMAGE[it.type],
    moq: 1,
    groupId: `neo-pdo-${slug}`,
    variantLabel: it.spec || it.code,
    groupName: `NeoGenesis PDO ${it.type} Thread`,
    groupImage: IMAGE[it.type],
    packaging: '20 EA (1 pouch). 1 box = 5 pouches = 100 EA.',
    indication: `PDO ${it.type.toLowerCase()} thread for skin tightening and collagen stimulation.`,
  };
}

async function main() {
  const supabase = createClient(url!, key!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: blob, error } = await supabase.storage.from(BUCKET).download(OBJECT);
  if (error || !blob) { console.error('Download failed:', error?.message); process.exit(1); }
  const parsed = JSON.parse(await blob.text());
  const products: any[] = Array.isArray(parsed) ? parsed : parsed.products;

  const red = await extractRed();
  const byType: Record<string, number> = {};
  red.forEach(r => { byType[r.type] = (byType[r.type] ?? 0) + 1; });
  console.log(`Red Mono/Screw/Twin found: ${red.length}  (${JSON.stringify(byType)})`);

  const existingNames = new Set(products.map(p => String(p.name).trim().toUpperCase()));
  const toAdd = red.filter(r => !existingNames.has(r.code.toUpperCase()));
  const skipped = red.length - toAdd.length;

  let maxId = Math.max(0, ...products.map(p => Number(p.id) || 0));
  const built = toAdd.map(it => buildProduct(it, ++maxId));

  console.log(`\nWill ADD ${built.length} products (skipped ${skipped} already present):`);
  for (const t of ['Mono', 'Screw', 'Twin'] as Type[]) {
    const rows = built.filter(b => b.groupId === `neo-pdo-${t.toLowerCase()}`);
    if (!rows.length) continue;
    console.log(`\n  [${t}] $${PRICE[t]} — group "neo-pdo-${t.toLowerCase()}" (${rows.length})`);
    rows.forEach(r => console.log(`    #${r.id}  ${r.name}  — ${r.specification}`));
  }

  if (!APPLY) {
    console.log('\n(PREVIEW only — no changes written. Re-run with --apply to save.)');
    return;
  }
  if (built.length === 0) { console.log('\nNothing to add.'); return; }

  products.push(...built);
  const out = Array.isArray(parsed) ? products : { ...parsed, products };
  const body = Buffer.from(JSON.stringify(out, null, 2), 'utf8');
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (upErr) { console.error('Upload failed:', upErr.message); process.exit(1); }
  console.log(`\nApplied: added ${built.length} products. Catalogue now ${products.length} total.`);

  // Bust the live catalogue cache.
  const secret = process.env.REVALIDATE_SECRET;
  const target = (process.env.REVALIDATE_URL || 'https://www.lumeemaison.com').replace(/\/$/, '');
  if (secret) {
    try {
      const res = await fetch(`${target}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
        body: JSON.stringify({ tag: 'catalogue' }),
      });
      console.log(res.ok ? `Cache busted (${target}).` : `Cache bust ${res.status} — live refreshes within ~5 min.`);
    } catch (e) {
      console.log(`Cache bust skipped (${e instanceof Error ? e.message : 'error'}).`);
    }
  }
}

main();
