import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/catalogue';
import { getStockFlagsMap, orderableCap, perOrderLimit, stockKey } from '@/lib/products/stock';
import { capKey } from '@/lib/products/capKey';

export const dynamic = 'force-dynamic';

// Per-(product, option) orderable cap for the cart. The cart lives in the
// browser (localStorage) and holds (id, option) lines; this returns, per key,
// the max quantity each line may hold (`cap`) plus the product's per-order limit
// (`perOrder`, null = none) so the UI can disable "+" at the cap and show the
// right message ("only N in stock" vs "limited to N per order"). The
// authoritative cap is re-checked in createOrder — this only drives the cart
// UI. Body: { keys: [{ product_id, option }] }.
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
    }))
    .filter(k => Number.isFinite(k.product_id))
    .slice(0, 500);
  if (keys.length === 0) return NextResponse.json({});

  const [products, flagsMap] = await Promise.all([
    getAllProducts(),
    getStockFlagsMap(keys.map(k => ({ product_id: k.product_id, option: k.option }))),
  ]);
  const byId = new Map(products.map(p => [p.id, p]));

  const out: Record<string, { cap: number; perOrder: number | null }> = {};
  for (const k of keys) {
    const flags = flagsMap[stockKey(k.product_id, k.option)];
    const product = byId.get(k.product_id);
    out[capKey(k.product_id, k.option)] = {
      cap: orderableCap(product, flags),
      perOrder: perOrderLimit(product),
    };
  }
  return NextResponse.json(out);
}
