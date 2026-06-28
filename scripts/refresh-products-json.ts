// Pulls the live catalogue from Supabase Storage and refreshes data/products.json.
// Categories are NOT stored in the live store — the existing categories array is
// preserved; only the products array is swapped out.
//
//   npx tsx scripts/refresh-products-json.ts
//
// Reads env from `.env.local`.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ---------- dotenv prelude (mirrors scripts/ensure-payment-proofs-bucket.ts) ----------
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
// -------------------------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const OUT = resolve(process.cwd(), 'data', 'products.json');

async function main() {
  const supabase = createClient(url!, key!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.storage.from('catalogue').download('products.json');
  if (error || !data) throw new Error(`live store download failed: ${error?.message ?? 'no data'}`);

  const parsed = JSON.parse(await data.text());
  const liveProducts = Array.isArray(parsed) ? parsed : parsed.products;
  if (!Array.isArray(liveProducts)) throw new Error('unexpected live-store shape');

  // Categories are NOT stored in the live store (they stay bundled) — keep the
  // existing data/products.json categories, swap in the live products.
  const current = JSON.parse(readFileSync(OUT, 'utf8'));
  const next = { categories: current.categories, products: liveProducts };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log(`✓ refreshed data/products.json: ${current.products.length} → ${liveProducts.length} products`);
}
main().catch(e => { console.error(e); process.exit(1); });
