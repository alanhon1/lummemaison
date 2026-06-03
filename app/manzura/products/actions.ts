'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { setProductStock } from '@/lib/products/stock';

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
  return setProductStock(productId, stock);
}
