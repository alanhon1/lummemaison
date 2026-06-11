import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

export const dynamic = 'force-dynamic';

interface OrderRef {
  id: number;
  label: string;
  qty: number;
}
interface Row {
  productId: number;
  name: string;
  total: number;
  orders: OrderRef[];
}

// "To Order" — aggregates line items across every Payment-verified order so the
// admin sees, in one place, exactly what (and how many) to order from suppliers.
// Per-product total + a breakdown of which orders need it. Test orders excluded.
export default async function ProcurementPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, order_seq, order_number, created_at')
    .eq('status', 'payment_verified')
    .not('order_number', 'ilike', 'TEST-%')
    .order('created_at', { ascending: true });

  const orders = (ordersData ?? []) as Array<{
    id: number;
    order_seq: number | null;
    order_number: string;
    created_at: string;
  }>;
  const labelOf = (o: { order_seq: number | null; order_number: string }) =>
    o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
  const orderLabel = new Map(orders.map(o => [o.id, labelOf(o)]));

  const ids = orders.map(o => o.id);
  let items: Array<{ order_id: number; product_id: number; product_name: string; quantity: number }> = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('order_items')
      .select('order_id, product_id, product_name, quantity')
      .in('order_id', ids);
    items = (data ?? []) as typeof items;
  }

  // Aggregate by product, keeping which orders contributed (and how many).
  const byProduct = new Map<number, Row>();
  for (const it of items) {
    const qty = it.quantity ?? 0;
    const row =
      byProduct.get(it.product_id) ??
      { productId: it.product_id, name: it.product_name, total: 0, orders: [] };
    row.total += qty;
    const ex = row.orders.find(o => o.id === it.order_id);
    if (ex) ex.qty += qty;
    else row.orders.push({ id: it.order_id, label: orderLabel.get(it.order_id) ?? `#${it.order_id}`, qty });
    byProduct.set(it.product_id, row);
  }
  const rows = [...byProduct.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const totalUnits = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display text-2xl sm:text-3xl font-light text-charcoal mb-1">To Order</h1>
      <p className="text-sm text-mist mb-6">
        Items from <strong className="text-charcoal font-semibold">Payment verified</strong> orders, totalled by
        product. Tap a product to see which orders need it. Test orders excluded.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone rounded-md p-10 text-center">
          Nothing to order — no payment-verified orders right now.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-charcoal mb-5">
            <span><strong className="font-semibold">{rows.length}</strong> products</span>
            <span><strong className="font-semibold">{totalUnits}</strong> units total</span>
            <span><strong className="font-semibold">{orders.length}</strong> orders</span>
          </div>

          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.productId}>
                <details className="group bg-white border border-bone rounded-lg overflow-hidden">
                  <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none hover:bg-cream/50">
                    <ChevronRight size={14} className="text-mist shrink-0 transition-transform group-open:rotate-90" />
                    <span className="text-[11px] text-mist font-mono w-9 shrink-0">#{r.productId}</span>
                    <span className="flex-1 text-sm text-charcoal leading-snug">{r.name}</span>
                    <span className="text-[11px] text-mist whitespace-nowrap hidden sm:inline">
                      {r.orders.length} order{r.orders.length === 1 ? '' : 's'}
                    </span>
                    <span className="inline-flex items-center justify-center min-w-9 h-7 px-2 rounded-md bg-charcoal text-cream text-sm font-semibold tabular-nums">
                      ×{r.total}
                    </span>
                  </summary>
                  <div className="border-t border-bone bg-cream/30 px-4 sm:px-12 py-1">
                    <ul className="divide-y divide-bone/60">
                      {r.orders.map(o => (
                        <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                          <Link href={`/manzura/orders/${o.id}`} className="text-gold-dark hover:underline">
                            {o.label}
                          </Link>
                          <span className="text-charcoal tabular-nums">×{o.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
