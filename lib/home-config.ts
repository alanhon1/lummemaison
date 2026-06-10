import 'server-only';

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/server';

// Ordered home-page section lists (product ids), stored in Supabase Storage so
// admin curation persists on Vercel. New Arrivals is NOT here — it's automatic
// (newest products by id). Featured (전시) and Best Sellers are admin-ordered.
const BUCKET = 'catalogue';
const OBJECT = 'home-config.json';

export interface HomeConfig {
  featured: number[];
  bestSellers: number[];
}

const EMPTY: HomeConfig = { featured: [], bestSellers: [] };

function asIdArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];
}

export const loadHomeConfig = cache(async (): Promise<HomeConfig> => {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(OBJECT);
    if (error || !data) return EMPTY;
    const parsed = JSON.parse(await data.text());
    return { featured: asIdArray(parsed.featured), bestSellers: asIdArray(parsed.bestSellers) };
  } catch {
    return EMPTY;
  }
});

export async function saveHomeConfig(cfg: HomeConfig): Promise<void> {
  const supabase = createServiceClient();
  const body = Buffer.from(JSON.stringify(cfg, null, 2), 'utf8');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(OBJECT, body, { upsert: true, contentType: 'application/json' });
  if (error) throw new Error(`home config save failed: ${error.message}`);
}
