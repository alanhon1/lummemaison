import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/lib/catalogue';
import { isAvailableForOrder } from '@/lib/products';

export const dynamic = 'force-dynamic';

// Public availability lookup for the cart / checkout. The cart lives in the
// browser (localStorage) and can hold items that were flagged notForSale /
// outOfStock — or deleted entirely — AFTER they were added, so the client
// re-checks live flags here to surface the block and disable checkout BEFORE
// the customer pays (payment is off-platform, so a paid-then-rejected order is
// a real harm). The authoritative block is still enforced in createOrder; this
// endpoint only drives the UI. Accepts ?ids=1,2,3 and returns a JSON map of
// { [id]: { notForSale, outOfStock } }. Unknown ids report as out of stock.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map(s => Number.parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n));
  if (ids.length === 0) {
    return NextResponse.json({});
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Too many ids.' }, { status: 400 });
  }

  const wanted = new Set(ids);
  const products = await getAllProducts();
  const out: Record<string, { notForSale: boolean; outOfStock: boolean }> = {};
  for (const p of products) {
    if (wanted.has(p.id)) {
      // `outOfStock` here means "blocked from ordering" — derived from the
      // admin Available-for-order switch (with legacy-flag fallback), NOT the
      // real stock count, so stock-0 preorders stay purchasable.
      out[String(p.id)] = { notForSale: !!p.notForSale, outOfStock: !isAvailableForOrder(p) };
    }
  }
  // Ids missing from the live catalogue (deleted product) are not purchasable —
  // report them as out of stock so the cart blocks them like any other.
  for (const id of ids) {
    if (!out[String(id)]) out[String(id)] = { notForSale: false, outOfStock: true };
  }
  return NextResponse.json(out);
}
