import 'server-only';

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/server';
import bundled from '@/data/products.json';
import type { Product } from '@/lib/products';

// Product catalogue persistence.
//
// Products are the source of truth in a Supabase Storage object so that admin
// edits persist and show on the live site (Vercel's runtime filesystem is
// read-only, so the old data/products.json write path could not work in prod).
// The bundled data/products.json is the seed/fallback used until the first save.
//
// Categories are NOT stored here — they stay bundled (see lib/products.ts) so
// client components can import them synchronously.

const BUCKET = 'catalogue';
const OBJECT = 'products.json';

type ServiceClient = ReturnType<typeof createServiceClient>;

async function ensureBucket(supabase: ServiceClient): Promise<void> {
  try {
    await supabase.storage.createBucket(BUCKET, { public: false });
  } catch {
    // Already exists (or a benign race) — fine.
  }
}

async function downloadProducts(): Promise<Product[] | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(OBJECT);
    if (error || !data) return null;
    const parsed = JSON.parse(await data.text());
    const arr = Array.isArray(parsed) ? parsed : parsed.products;
    return Array.isArray(arr) ? (arr as Product[]) : null;
  } catch {
    return null;
  }
}

// Returns the live product list. Memoized per request (React cache) so a single
// page render downloads it once; always fresh across requests so admin edits
// show up immediately. Falls back to the bundled seed if the storage object
// doesn't exist yet or can't be read.
export const loadProducts = cache(async (): Promise<Product[]> => {
  const fromStore = await downloadProducts();
  return fromStore ?? ((bundled as { products: Product[] }).products);
});

// Overwrites the stored product list.
export async function persistProducts(products: Product[]): Promise<void> {
  const supabase = createServiceClient();
  await ensureBucket(supabase);
  const body = Buffer.from(JSON.stringify({ products }, null, 2), 'utf8');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(`catalogue save failed: ${error.message}`);
}
