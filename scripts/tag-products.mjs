// #6 — Generate 6–15 searchable hashtags for EVERY product in the live catalogue
// (Supabase Storage). Heuristic: category base tags + ingredient/concern keyword
// extraction from name/spec/description/indication, merged with (and preserving)
// any existing hand-curated tags. Tags are stored as clean tokens WITHOUT '#'
// (the UI adds '#'; search strips '#') and normalized — existing hand-tags that
// packed multiple "#a #b" into one string get split/cleaned too.
//
//   node scripts/tag-products.mjs            # DRY: writes a preview report, no upload
//   node scripts/tag-products.mjs --apply    # backs up live catalogue, then uploads
//
// Reversible: --apply first copies the current catalogue to
// catalogue/backups/products-<ts>-<n>p.json (same as the admin backup feature).

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const SKIP = new Set(['sale', 'new', 'bestseller', 'best-seller', 'soldout']);
const MIN = 6, MAX = 15;

// Category → base tags (≥5 each so every product clears the floor of 6).
const CATEGORY_TAGS = {
  fillers: ['dermalfiller', 'filler', 'hyaluronicacid', 'HA', 'volumizing', 'aestheticinjectable', 'antiaging'],
  mesotherapy: ['mesotherapy', 'skinbooster', 'biorevitalization', 'hydration', 'skinregeneration', 'aestheticinjectable'],
  'acne-treatment': ['acne', 'acnetreatment', 'blemishcare', 'oilyskin', 'skincare', 'breakout'],
  'hair-treatment': ['hairloss', 'hairregrowth', 'haircare', 'scalphealth', 'hairgrowth', 'hairdensity'],
  'pharmacy-favourites': ['pharmacy', 'OTC', 'healthcare', 'wellness', 'medicine'],
  'topical-cosmetics': ['cosmetics', 'skincare', 'topical', 'facecare', 'beauty'],
  'intimate-care': ['intimatecare', 'femininecare', 'personalcare', 'hygiene', 'wellness'],
  'growth-factor-exosome': ['exosome', 'growthfactor', 'regeneration', 'skinrejuvenation', 'antiaging', 'repair'],
  curenex: ['curenex', 'skinbooster', 'PDRN', 'rejuvenation', 'hydration', 'aestheticinjectable'],
  dermagen: ['dermagen', 'skincare', 'rejuvenation', 'skinhealth', 'aesthetic'],
  gtm: ['GTM', 'skincare', 'poretightening', 'skintexture', 'brightening', 'Kbeauty'],
  equipment: ['equipment', 'device', 'aesthetictool', 'clinic', 'professional'],
  'salon-grade': ['salongrade', 'professional', 'largeformat', 'clinic', 'aesthetic'],
  lipolytics: ['lipolytics', 'fatdissolving', 'fatburning', 'bodycontouring', 'slimming', 'aestheticinjectable'],
  botulinum: ['botulinumtoxin', 'antiwrinkle', 'wrinklereduction', 'facialcontouring', 'antiaging', 'aestheticinjectable'],
  injections: ['injectable', 'injection', 'aesthetictreatment', 'clinic', 'skinrejuvenation'],
  anesthetics: ['anesthetic', 'numbing', 'paincontrol', 'topicalanesthetic', 'procedurecare'],
  'placental-therapy': ['placentatherapy', 'placenta', 'regeneration', 'antiaging', 'revitalization'],
  'nano-needle-cannula': ['cannula', 'needle', 'microneedle', 'injectiontool', 'clinicsupply', 'MTS'],
  'imported-products': ['imported', 'aesthetic', 'skincare', 'beauty', 'clinic'],
};

// [regex over combined lowercased text, ...tags]
const KEYWORDS = [
  [/hyaluron/, ['hyaluronicacid', 'HA']],
  [/lidocaine/, ['lidocaine', 'painfree']],
  [/\bpdrn\b|polydeoxyribonucleotide/, ['PDRN', 'salmonDNA', 'regeneration']],
  [/polynucleotide|\bpn\b/, ['polynucleotide', 'PN', 'regeneration']],
  [/plla|poly[- ]?l[- ]?lactic|polylactic/, ['PLLA', 'collagenstimulator', 'neocollagenesis']],
  [/\bpcl\b|polycaprolactone/, ['PCL', 'collagenstimulator', 'neocollagenesis']],
  [/calcium hydroxylapatite|\bcahaa?\b|radiesse/, ['calciumhydroxylapatite', 'collagenstimulator']],
  [/glutathione/, ['glutathione', 'skinbrightening', 'antioxidant']],
  [/ascorbic|vitamin c\b/, ['vitaminC', 'brightening', 'antioxidant']],
  [/vitamin b12|cobalamin/, ['vitaminB12']],
  [/collagen/, ['collagen', 'collagenboost']],
  [/peptide/, ['peptide']],
  [/exosome/, ['exosome', 'regeneration']],
  [/growth factor|\begf\b|\bfgf\b/, ['growthfactor', 'skinrepair']],
  [/botulinum|botox|toxin/, ['botulinumtoxin', 'antiwrinkle']],
  [/\blip[s]?\b|perioral/, ['lips', 'lipenhancement']],
  [/cheek|midface|malar/, ['cheek', 'facialcontouring']],
  [/jaw|chin|mandib/, ['jawline', 'facialcontouring']],
  [/tear trough|under[- ]?eye|periorbital|dark circle/, ['undereye', 'darkcircles']],
  [/nasolabial|smile line|marionette/, ['nasolabialfolds', 'wrinklecare']],
  [/wrinkle|fine line|rhytid/, ['wrinklecare', 'finelines', 'antiaging']],
  [/volume|volumiz/, ['volumizing']],
  [/lift|tighten|firm/, ['lifting', 'skinfirming']],
  [/hydrat|moistur/, ['hydration']],
  [/elasticit/, ['skinelasticity']],
  [/whiten|bright|lighten|tone[- ]?up/, ['brightening', 'skintone']],
  [/pigment|melasma|melanin|dark spot/, ['pigmentation', 'spotcare']],
  [/acne|blemish|pimple|breakout/, ['acne', 'blemishcare']],
  [/pore/, ['poretightening', 'porecare']],
  [/\bscar/, ['scarcare']],
  [/\bhair\b|alopecia|scalp/, ['haircare', 'scalphealth']],
  [/finasteride|dutasteride|dht/, ['DHTBlocker', 'hairloss']],
  [/minoxidil/, ['minoxidil', 'hairregrowth']],
  [/\bfat\b|lipo|cellulit|slim/, ['fatdissolving', 'bodycontouring']],
  [/cannula/, ['cannula', 'injectiontool']],
  [/needle|micro[- ]?needl|\bmts\b/, ['microneedle', 'needle']],
  [/\bmask\b/, ['mask', 'sheetmask']],
  [/peel/, ['peeling', 'exfoliation']],
  [/serum|ampoule/, ['serum']],
  [/cream|lotion|balm/, ['cream', 'topical']],
  [/numbing|anesthe|anaesthe/, ['anesthetic', 'numbing']],
  [/placenta/, ['placenta', 'revitalization']],
  [/centella|cica/, ['cica', 'centellaasiatica', 'skincalming']],
  [/snail/, ['snailmucin', 'hydration']],
  [/aloe/, ['aloe', 'soothing']],
  [/niacinamide/, ['niacinamide', 'brightening']],
  [/retino/, ['retinol', 'antiaging']],
  [/salicylic|\blha\b|\bbha\b/, ['salicylicacid', 'exfoliation', 'porecare']],
  [/post[- ]?(treatment|laser|peel|care)|aftercare|soothing|sensitive/, ['aftercare', 'postcare', 'skincalming']],
];

function normalizeExisting(tags) {
  return (tags ?? [])
    .flatMap(t => String(t).split(/\s+/))
    .map(t => t.replace(/^#+/, '').trim())
    .filter(t => t && !SKIP.has(t.toLowerCase()));
}

function nameTag(name) {
  const cleaned = String(name).replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9]+\s?(mg|ml|g|mcg|iu|%|tab|tablets?|inj|syr|vial|amp|ea|x)\b/gi, ' ')
    .replace(/[^A-Za-z ]/g, ' ')
    .trim();
  const camel = cleaned.split(/\s+/).filter(Boolean).slice(0, 4).map(w => w[0].toUpperCase() + w.slice(1)).join('');
  return camel.length >= 4 && camel.length <= 26 ? camel : null;
}

function dedupeCI(arr) {
  const seen = new Set(); const out = [];
  for (const t of arr) { const k = t.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(t); } }
  return out;
}

function generate(p) {
  const text = `${p.name ?? ''} ${p.specification ?? ''} ${p.description ?? ''} ${p.indication ?? ''} ${p.packaging ?? ''}`.toLowerCase();
  const existing = normalizeExisting(p.tags);
  const kw = [];
  for (const [re, tags] of KEYWORDS) if (re.test(text)) kw.push(...tags);
  const cat = CATEGORY_TAGS[p.categoryId] ?? ['aesthetic', 'skincare', 'clinic', 'beauty', 'treatment'];
  const nt = nameTag(p.name);
  // Priority: curated existing → extracted keywords → category → name.
  const merged = dedupeCI([...existing, ...kw, ...cat, ...(nt ? [nt] : [])]);
  // Never truncate hand-curated tags: cap is at least MAX, or the existing count
  // if the product was manually tagged with more than MAX.
  const cap = Math.max(MAX, existing.length);
  return merged.slice(0, cap);
}

async function main() {
  loadDotEnv('.env.local');
  const apply = process.argv.includes('--apply');
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { Authorization: `Bearer ${key}`, apikey: key };

  const res = await fetch(`${base}/storage/v1/object/catalogue/products.json`, { headers: H });
  if (!res.ok) { console.error(`Cannot read live catalogue (HTTP ${res.status})`); process.exit(1); }
  const rawText = await res.text();
  const parsed = JSON.parse(rawText);
  const products = Array.isArray(parsed) ? parsed : parsed.products;

  let belowMin = 0; const counts = [];
  for (const p of products) {
    p.tags = generate(p);
    counts.push(p.tags.length);
    if (p.tags.length < MIN) belowMin++;
  }
  const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
  console.log(`Products: ${products.length} · tags avg ${avg} · min ${Math.min(...counts)} · max ${Math.max(...counts)} · below ${MIN}: ${belowMin}`);

  // Preview report (always).
  const lines = [`TAG GENERATION PREVIEW — ${products.length} products · avg ${avg} tags · below ${MIN}: ${belowMin}`, ''];
  for (const p of products) lines.push(`#${p.id} [${p.categoryId}] ${p.name}\n   ${p.tags.join(', ')}`);
  writeFileSync(resolve(process.cwd(), 'scripts', 'tag-products-preview.txt'), lines.join('\n'), 'utf8');
  console.log('Preview → scripts/tag-products-preview.txt');

  if (!apply) { console.log('\nDRY RUN — no upload. Re-run with --apply to back up + write live.'); return; }

  // Backup current live catalogue first (admin-backup-compatible name).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backups/products-${stamp}-${products.length}p.json`;
  const bk = await fetch(`${base}/storage/v1/object/catalogue/${backupName}`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body: rawText,
  });
  console.log(`Backup ${bk.ok ? 'OK' : 'FAILED ' + bk.status} → catalogue/${backupName}`);
  if (!bk.ok) { console.error('Aborting — backup failed.'); process.exit(1); }

  // Upload tagged catalogue.
  const body = JSON.stringify({ products }, null, 2);
  const up = await fetch(`${base}/storage/v1/object/catalogue/products.json`, {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json', 'x-upsert': 'true' }, body,
  });
  console.log(`Upload ${up.ok ? 'OK — tags are now live' : 'FAILED ' + up.status + ' ' + (await up.text())}`);
}

main().catch(e => { console.error(e); process.exit(1); });
