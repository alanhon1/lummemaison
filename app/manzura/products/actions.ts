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
  option: string,
  stock: number,
): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, error: 'Invalid product id.' };
  }

  const oldStock = await getProductStock(productId, option);
  const result = await setProductStock(productId, option, stock);
  if (!result.ok) return result;

  const delta = Math.max(0, Math.floor(stock)) - oldStock;
  if (delta !== 0) {
    // Best-effort ledger row — don't fail the save if it can't be written, but
    // surface the error in logs (supabase-js returns it, never throws) so a
    // schema mismatch doesn't silently drop adjustment history again.
    const { error: movErr } = await createServiceClient().from('stock_movements').insert({
      product_id: productId,
      option,
      delta,
      reason: 'adjustment',
    });
    if (movErr) console.error('[stock] adjustment ledger insert failed:', movErr.message);
  }

  return result;
}

export async function toggleWonderAction(
  productId: number,
  option: string,
  wonder: boolean,
): Promise<SaveStockResult> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return { ok: false, error: 'Not authorized.' };
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, error: 'Invalid product id.' };
  }
  return setProductWonder(productId, option, wonder);
}
