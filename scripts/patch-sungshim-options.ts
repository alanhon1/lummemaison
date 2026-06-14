// One-off: give the Sungshim products (#399/#400/#401) their option lists and
// mark them notForSale, in the LIVE catalogue (Supabase Storage products.json).
// Option strings MUST match scripts/skin-global-manual-map.json exactly so the
// per-option stock rows line up.
//
//   npx tsx scripts/patch-sungshim-options.ts
//
// Reversible: re-run with EMPTY edits, or restore from the committed backup.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('='); if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = v;
  }
}
loadDotEnv('.env.local'); loadDotEnv('.env');

const PATCH: Record<number, { options: string[]; notForSale: boolean }> = {
  400: { options: ['0.5mL/30G/8mm', '0.5mL/31G/8mm', '1mL/30G/8mm', '1mL/31G/8mm'], notForSale: true },
  399: { options: ['30G/13mm', '30G/4mm'], notForSale: true },
  401: { options: ['32G/6mm'], notForSale: true },
};

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: blob, error } = await s.storage.from('catalogue').download('products.json');
  if (error || !blob) { console.error('download failed', error?.message); process.exit(1); }
  const doc = JSON.parse(await blob.text());
  const products = Array.isArray(doc) ? doc : doc.products;
  if (!Array.isArray(products)) { console.error('unexpected shape'); process.exit(1); }

  let changed = 0;
  for (const p of products) {
    const patch = PATCH[p.id as number];
    if (!patch) continue;
    p.options = patch.options;
    p.notForSale = patch.notForSale;
    changed++;
    console.log(`#${p.id} ${p.name} → options=[${patch.options.join(', ')}], notForSale=${patch.notForSale}`);
  }
  if (changed !== Object.keys(PATCH).length) {
    console.error(`Expected to patch ${Object.keys(PATCH).length} products but changed ${changed}. Aborting upload.`);
    process.exit(1);
  }

  const out = Array.isArray(doc) ? products : { ...doc, products };
  const { error: upErr } = await s.storage.from('catalogue').upload('products.json', JSON.stringify(out), {
    contentType: 'application/json', upsert: true,
  });
  if (upErr) { console.error('upload failed', upErr.message); process.exit(1); }
  console.log(`Patched ${changed} products in the live catalogue. Run sync-bundled-from-live to refresh the backup.`);
}
main();
