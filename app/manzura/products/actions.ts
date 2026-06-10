'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getProductStock, setProductStock } from '@/lib/products/stock';
import { createServiceClient } from '@/lib/supabase/server';
import { loadHomeConfig, saveHomeConfig } from '@/lib/home-config';

export interface SaveStockResult {
  ok: boolean;
  error?: string;
}

export async function saveProductStockAction(
  productId: number,
  stock: number,
): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, error: 'Invalid product id.' };
  }

  const oldStock = await getProductStock(productId);
  const result = await setProductStock(productId, stock);
  if (!result.ok) return result;

  const delta = Math.max(0, Math.floor(stock)) - oldStock;
  if (delta !== 0) {
    try {
      await createServiceClient().from('stock_movements').insert({
        product_id: productId,
        delta,
        reason: 'adjustment',
      });
    } catch {
      // Best-effort — don't fail the save if the ledger insert fails.
    }
  }

  return result;
}

// Saves the ordered product-id list for one home section (전시 = 'featured',
// Best Sellers = 'bestSellers'). Merges into the existing config so editing one
// section never clobbers the other. Revalidates the home page.
export async function saveHomeSection(
  section: 'featured' | 'bestSellers',
  ids: number[],
): Promise<{ ok: boolean; error?: string }> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (section !== 'featured' && section !== 'bestSellers') {
    return { ok: false, error: 'Invalid section.' };
  }
  const clean = Array.from(new Set(ids.filter(n => Number.isFinite(n)))).slice(0, 24);
  try {
    const cfg = await loadHomeConfig();
    await saveHomeConfig({ ...cfg, [section]: clean });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' };
  }
}
