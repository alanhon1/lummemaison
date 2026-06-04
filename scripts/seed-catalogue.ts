// Seeds the live product catalogue store from data/products.json.
//   npx tsx scripts/seed-catalogue.ts
//
// Creates the private `catalogue` Supabase Storage bucket if needed and uploads
// `products.json` ({ products: [...] }). Idempotent — safe to re-run. After the
// app starts persisting edits, this is only needed for a fresh reseed.
// Reads env from `.env.local`.

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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Ensure bucket.
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
    if (error) {
      console.error(`Failed to create bucket "${BUCKET}":`, error.message);
      process.exit(1);
    }
    console.log(`Bucket "${BUCKET}" created (private).`);
  } else {
    console.log(`Bucket "${BUCKET}" already exists.`);
  }

  // Upload products.
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'data', 'products.json'), 'utf8'));
  const products = raw.products;
  const body = Buffer.from(JSON.stringify({ products }, null, 2), 'utf8');
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (upErr) {
    console.error('Upload failed:', upErr.message);
    process.exit(1);
  }
  console.log(`Uploaded ${products.length} products to ${BUCKET}/${OBJECT}.`);

  // Verify.
  const { data, error: dlErr } = await supabase.storage.from(BUCKET).download(OBJECT);
  if (dlErr || !data) {
    console.error('Verify download failed:', dlErr?.message);
    process.exit(1);
  }
  const parsed = JSON.parse(await data.text());
  console.log(`Verified: store now holds ${parsed.products.length} products.`);
}

main();
