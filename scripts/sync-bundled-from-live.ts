// Syncs the bundled data/products.json (the git-committed seed / fallback that
// the site uses when Supabase Storage is unavailable) FROM the live catalogue in
// Storage. This bakes the current live products — including fake originalPrices,
// new products, options, group/category assignments — into the committed backup.
//
//   npx tsx scripts/sync-bundled-from-live.ts
//
// Categories stay bundled (Storage holds products only), so the existing
// categories array in data/products.json is preserved as-is.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDotEnv(file: string) {
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
loadDotEnv('.env.local'); loadDotEnv('.env');

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: blob, error } = await s.storage.from('catalogue').download('products.json');
  if (error || !blob) { console.error('download failed', error?.message); process.exit(1); }
  const live = JSON.parse(await blob.text());
  const products = Array.isArray(live) ? live : live.products;
  if (!Array.isArray(products)) { console.error('unexpected live shape'); process.exit(1); }

  const file = resolve(process.cwd(), 'data/products.json');
  const bundled = JSON.parse(readFileSync(file, 'utf8'));
  const categories = bundled.categories; // bundle-only, keep as-is

  const onSale = products.filter((p: any) => typeof p.originalPrice === 'number' && p.originalPrice > p.price).length;
  const out = { categories, products };
  writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`Synced data/products.json: ${products.length} products (${onSale} on sale), ${categories.length} categories.`);
}
main();
