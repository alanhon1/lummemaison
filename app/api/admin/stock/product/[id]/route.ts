import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return NextResponse.json({ error: 'not authorized' }, { status: 401 });

  const { id } = await params;
  const productId = Number.parseInt(id, 10);
  if (!Number.isFinite(productId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const option = req.nextUrl.searchParams.get('option') ?? '';

  const supabase = createServiceClient();

  // order_items.option is nullable (rows predate options), so only filter it
  // when a specific option is requested; '' = whole product = all its orders.
  let orderItemsQuery = supabase
    .from('order_items')
    .select('quantity, option, orders(id, order_seq, order_number, created_at, status, customer_name, total_cents, currency)')
    .eq('product_id', productId);
  if (option) orderItemsQuery = orderItemsQuery.eq('option', option);

  const [{ data: movements }, { data: orderItems }, { data: stock }] = await Promise.all([
    supabase
      .from('stock_movements')
      .select('id, delta, reason, created_at, note, companies(name), orders(order_seq, order_number)')
      .eq('product_id', productId)
      .eq('option', option)
      .order('created_at', { ascending: false })
      .limit(200),
    orderItemsQuery
      .order('created_at', { ascending: false, referencedTable: 'orders' })
      .limit(100),
    supabase
      .from('product_stock')
      .select('stock')
      .eq('product_id', productId)
      .eq('option', option)
      .maybeSingle(),
  ]);

  type RawMovement = {
    id: number; delta: number; reason: string; created_at: string; note: string | null;
    companies: { name: string } | null;
    orders: { order_seq: number | null; order_number: string } | null;
  };

  type RawOrderItem = {
    quantity: number;
    orders: {
      id: number; order_seq: number | null; order_number: string;
      created_at: string; status: string; customer_name: string;
      total_cents: number; currency: string;
    } | null;
  };

  const movs = ((movements ?? []) as unknown as RawMovement[]).map(m => ({
    id: m.id,
    delta: m.delta,
    reason: m.reason,
    created_at: m.created_at,
    note: m.note,
    company: m.companies?.name ?? null,
    order_ref: m.orders
      ? (m.orders.order_seq != null ? formatOrderNumber(m.orders.order_seq) : m.orders.order_number)
      : null,
  }));

  const recentOrders = ((orderItems ?? []) as unknown as RawOrderItem[])
    .filter(r => r.orders !== null)
    .map(r => ({
      id: r.orders!.id,
      order_ref: r.orders!.order_seq != null
        ? formatOrderNumber(r.orders!.order_seq)
        : r.orders!.order_number,
      quantity: r.quantity,
      status: r.orders!.status,
      customer_name: r.orders!.customer_name,
      total_cents: r.orders!.total_cents,
      currency: r.orders!.currency,
      created_at: r.orders!.created_at,
    }));

  return NextResponse.json({
    currentStock: (stock?.stock as number | null) ?? 0,
    movements: movs,
    recentOrders,
  });
}
