'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getProductStock, setProductStock, setProductWonder } from '@/lib/products/stock';
import { createServiceClient } from '@/lib/supabase/server';

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

export async function toggleWonderAction(
  productId: number,
  wonder: boolean,
): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, error: 'Invalid product id.' };
  }
  return setProductWonder(productId, wonder);
}
