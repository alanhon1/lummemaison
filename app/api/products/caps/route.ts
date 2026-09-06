import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/catalogue';
import { getStockFlagsMap, orderableCap, perOrderLimit, stockKey } from '@/lib/products/stock';
import { purchaseBlockReason } from '@/lib/products';
import { capKey } from '@/lib/products/capKey';
import type { CapAnswer, CapLimitReason } from '@/lib/products/capTypes';

export const dynamic = 'force-dynamic';

// Per-(product, option) purchase limits for the cart and the catalogue cards.
//
// NUMERIC STOCK NEVER LEAVES THE SERVER. This endpoint used to return the raw
// orderable cap, which for a stock-limited line *is* the stock count. It now
// answers only the questions the UI actually has, as booleans:
//
//   canAdd     — may the customer add one more on top of `quantity`?
//   mustReduce — is the quantity already above what we can supply? (the line
//                must come down before checkout; we never say by how much)
//   outOfStock — nothing available at all for this (product, option)
//   limitReason— which constraint is binding, so the UI picks the right message
//
// `perOrder` IS returned: it is an admin-set policy number, already shown to
// customers as "Limited to N per order", and says nothing about inventory.
//
// Body: { keys: [{ product_id, option?, quantity? }] }. `quantity` is what the
// cart currently holds for that line (0 for a fresh card).
// The authoritative cap is re-checked in createOrder — this only drives the UI.


export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const rawKeys = Array.isArray((body as { keys?: unknown })?.keys)
    ? (body as { keys: unknown[] }).keys
    : [];
  const keys = rawKeys
    .map(k => ({
      product_id: Number((k as { product_id?: unknown })?.product_id),
      option: typeof (k as { option?: unknown })?.option === 'string'
        ? ((k as { option: string }).option)
        : '',
      quantity: Math.max(0, Math.floor(Number((k as { quantity?: unknown })?.quantity) || 0)),
    }))
    .filter(k => Number.isFinite(k.product_id))
    .slice(0, 500);
  if (keys.length === 0) return NextResponse.json({});

  const [products, flagsMap] = await Promise.all([
    getAllProducts(),
    getStockFlagsMap(keys.map(k => ({ product_id: k.product_id, option: k.option }))),
  ]);
  const byId = new Map(products.map(p => [p.id, p]));

  const out: Record<string, CapAnswer> = {};
  for (const k of keys) {
    const flags = flagsMap[stockKey(k.product_id, k.option)];
    const product = byId.get(k.product_id);
    // The cap is computed here and stays here — only its consequences ship.
    const cap = orderableCap(product, flags);
    const perOrder = perOrderLimit(product);
    const blocked = !product || purchaseBlockReason(product) !== null;

    const canAdd = k.quantity < cap;
    const mustReduce = k.quantity > cap;
    const outOfStock = !blocked && cap === 0;

    let limitReason: CapLimitReason = null;
    if (!canAdd) {
      if (blocked) limitReason = 'blocked';
      // The per-order limit is what's binding only when it is the tighter of
      // the two — otherwise it's stock, and we offer a restock request instead.
      else if (perOrder !== null && cap === perOrder) limitReason = 'perOrder';
      else limitReason = 'stock';
    }

    out[capKey(k.product_id, k.option)] = { canAdd, mustReduce, outOfStock, perOrder, limitReason };
  }
  return NextResponse.json(out);
}
