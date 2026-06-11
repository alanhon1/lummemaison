import 'server-only';

import { cache } from 'react';
import { unstable_cache, revalidateTag } from 'next/cache';
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
const CATALOGUE_TAG = 'catalogue';

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

// Cross-request / cross-deployment cache for the catalogue object.
//
// Previously this was memoized only per request (React `cache`), so EVERY
// dynamic render — home, /catalogue, every /product/[id] — and every chatbot
// message re-downloaded the full ~700KB products.json from Storage. That was
// the source of the runaway Supabase Storage egress (≈72GB/day from ~7MB of
// files). `unstable_cache` persists the parsed list across requests AND
// deployments, so Storage is hit at most once per `revalidate` window instead
// of once per request. Admin saves call `revalidateTag` (see persistProducts)
// for instant freshness; the 5-min revalidate is just a safety net.
const loadProductsCached = unstable_cache(
  async (): Promise<Product[]> => {
    const fromStore = await downloadProducts();
    return fromStore ?? (bundled as { products: Product[] }).products;
  },
  ['catalogue-products'],
  { tags: [CATALOGUE_TAG], revalidate: 300 },
);

// Returns the live product list. React `cache` dedupes within a single render;
// `unstable_cache` (above) dedupes across requests. Falls back to the bundled
// seed if the storage object doesn't exist yet or can't be read.
export const loadProducts = cache((): Promise<Product[]> => loadProductsCached());

// Overwrites the stored product list.
export async function persistProducts(products: Product[]): Promise<void> {
  const supabase = createServiceClient();
  await ensureBucket(supabase);
  const body = Buffer.from(JSON.stringify({ products }, null, 2), 'utf8');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(`catalogue save failed: ${error.message}`);
  // Drop the cached catalogue so admin edits appear immediately instead of
  // waiting out the revalidate window. Wrapped because revalidateTag is only
  // valid inside a request scope (route handler / server action) — a plain
  // script calling persistProducts must not crash here.
  try {
    // Next 16 exports the Cache-Components `revalidateTag` type (tag, profile),
    // but this project is NOT on cacheComponents — the runtime takes the legacy
    // single-tag form documented in the "Caching (Previous Model)" guide, which
    // is what invalidates an unstable_cache tag. Cast to that signature.
    (revalidateTag as (tag: string) => void)(CATALOGUE_TAG);
  } catch {
    /* not in a request scope (e.g. a CLI script) — cache will revalidate on its own */
  }
}
