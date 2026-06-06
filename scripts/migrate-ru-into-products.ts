// One-time migration: fold the legacy data/translations/ru.json into the live
// product objects as `*_ru` fields, persisted in the Supabase Storage catalogue
// (bucket `catalogue`, object `products.json`) — the same store the admin edits.
//
//   npm run migrate-ru-into-products
//
// Idempotent and non-destructive: only fills a `*_ru` field when it's empty, so
// re-running never clobbers admin-entered Russian. Mirrors lib/catalogue-store.ts
// (can't import it here — it pulls in next/headers). Reads env from .env.local.

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv('.env.local');
loadDotEnv('.env');

const BUCKET = 'catalogue';
const OBJECT = 'products.json';
const FIELDS = ['description', 'specification', 'indication', 'packaging', 'protocol'] as const;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

type Product = { id: number } & Record<string, unknown>;
type Translation = Partial<Record<(typeof FIELDS)[number], string>>;

async function loadLiveProducts(): Promise<Product[]> {
  // Prefer the live store; fall back to the bundled seed if it doesn't exist yet.
  const { data, error } = await supabase.storage.from(BUCKET).download(OBJECT);
  if (!error && data) {
    const parsed = JSON.parse(await data.text());
    const arr = Array.isArray(parsed) ? parsed : parsed.products;
    if (Array.isArray(arr)) return arr as Product[];
  }
  const bundled = JSON.parse(readFileSync(resolve(process.cwd(), 'data/products.json'), 'utf8'));
  return bundled.products as Product[];
}

async function main() {
  const ruPath = resolve(process.cwd(), 'data/translations/ru.json');
  if (!existsSync(ruPath)) {
    console.error('data/translations/ru.json not found — nothing to migrate.');
    process.exit(1);
  }
  const translations = JSON.parse(readFileSync(ruPath, 'utf8')) as Record<string, Translation>;

  const products = await loadLiveProducts();
  let filledFields = 0;
  let touchedProducts = 0;

  for (const product of products) {
    const t = translations[String(product.id)];
    if (!t) continue;
    let touched = false;
    for (const field of FIELDS) {
      const ruKey = `${field}_ru`;
      const value = t[field];
      if (value && !product[ruKey]) {
        product[ruKey] = value;
        filledFields++;
        touched = true;
      }
    }
    if (touched) touchedProducts++;
  }

  if (filledFields === 0) {
    console.log('No new Russian fields to migrate — store already up to date.');
    return;
  }

  // Ensure the bucket exists (private), then upsert the merged catalogue.
  try { await supabase.storage.createBucket(BUCKET, { public: false }); } catch { /* exists */ }
  const body = Buffer.from(JSON.stringify({ products }, null, 2), 'utf8');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (error) {
    console.error('Failed to persist catalogue:', error.message);
    process.exit(1);
  }

  console.log(`Migrated Russian into ${touchedProducts} product(s), ${filledFields} field(s). Catalogue saved.`);
}

main();
