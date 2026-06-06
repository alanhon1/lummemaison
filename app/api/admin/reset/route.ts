'use server';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// One-time data reset endpoint. DELETE THIS FILE after use.
// Usage: GET /api/admin/reset?secret=lumee-reset-2026
const SECRET = 'lumee-reset-2026';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const log: string[] = [];

  // 1. Stock movements first (references orders, companies, inbound_batches)
  const { error: e1, count: c1 } = await supabase
    .from('stock_movements').delete().neq('id', 0);
  if (e1) return NextResponse.json({ error: 'stock_movements: ' + e1.message });
  log.push(`stock_movements deleted (${c1 ?? '?'})`);

  // 2. Inbound batches
  const { error: e2 } = await supabase
    .from('inbound_batches').delete().neq('id', 0);
  if (e2) return NextResponse.json({ error: 'inbound_batches: ' + e2.message });
  log.push('inbound_batches deleted');

  // 3. Companies / suppliers
  const { error: e3 } = await supabase
    .from('companies').delete().neq('id', 0);
  if (e3) return NextResponse.json({ error: 'companies: ' + e3.message });
  log.push('companies deleted');

  // 4. Feedback (references orders ON DELETE SET NULL — delete before orders)
  const { error: e4 } = await supabase
    .from('feedback').delete().neq('id', 0);
  if (e4) return NextResponse.json({ error: 'feedback: ' + e4.message });
  log.push('feedback deleted');

  // 5. Orders (cascades → order_items, order_messages)
  const { error: e5, count: c5 } = await supabase
    .from('orders').delete().neq('id', 0);
  if (e5) return NextResponse.json({ error: 'orders: ' + e5.message });
  log.push(`orders deleted (${c5 ?? '?'})`);

  // 6. Delete all auth users (cascades → customer_profiles, password_reset_codes)
  let userCount = 0;
  let page = 1;
  while (true) {
    const { data, error: listErr } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (listErr) return NextResponse.json({ error: 'list users p' + page + ': ' + listErr.message });
    if (!data.users.length) break;
    for (const u of data.users) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
      if (delErr) return NextResponse.json({ error: 'delete user ' + u.id + ': ' + delErr.message });
      userCount++;
    }
    if (data.users.length < 1000) break;
    page++;
  }
  log.push(`auth users deleted (${userCount})`);

  // 7. Set all 420 product stocks to 50
  const ids = Array.from({ length: 420 }, (_, i) => i + 1);
  const { error: stockErr } = await supabase
    .from('product_stock')
    .upsert(ids.map(id => ({ product_id: id, stock: 50 })), { onConflict: 'product_id' });
  if (stockErr) return NextResponse.json({ error: 'product_stock: ' + stockErr.message });
  log.push('product_stock set to 50 for all 420 products');

  return NextResponse.json({ ok: true, log });
}
