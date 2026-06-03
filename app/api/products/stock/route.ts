import { NextRequest, NextResponse } from 'next/server';
import { getStockMap } from '@/lib/products/stock';

export const dynamic = 'force-dynamic';

// Client-side stock lookup. Used by the cart/product card to show SOLD OUT
// badges and clamp quantities. Accepts ?ids=1,2,3 and returns a JSON map.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map(s => Number.parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n));
  if (ids.length === 0) {
    return NextResponse.json({});
  }
  // Cap to a sensible upper bound — catalogue pages may load ~50 ids at once,
  // but reject pathological requests that would scan the table needlessly.
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Too many ids.' }, { status: 400 });
  }
  const map = await getStockMap(ids);
  return NextResponse.json(map);
}
