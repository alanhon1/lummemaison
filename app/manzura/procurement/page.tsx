import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getStockMap } from '@/lib/products/stock';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import ProcurementActions from '@/components/admin/ProcurementActions';

export const dynamic = 'force-dynamic';

interface OrderRef {
  id: number;
  label: string;
  qty: number;
  packing: boolean;
}
interface Row {
  productId: number;
  name: string;
  total: number;
  stock: number;
  orders: OrderRef[];
}

// "To Order" — aggregates line items across every Payment-verified (and Packing)
// order so the admin sees, in one place, exactly what (and how many) to order
// from suppliers, against current stock. Per-product total + a breakdown of
// which orders need it. Test orders excluded.
export default async function ProcurementPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, order_seq, order_number, status, created_at')
    .in('status', ['payment_verified', 'packaging'])
    .not('order_number', 'ilike', 'TEST-%')
    .order('created_at', { ascending: true });

  const orders = (ordersData ?? []) as Array<{
    id: number;
    order_seq: number | null;
    order_number: string;
    status: string;
    created_at: string;
  }>;
  const labelOf = (o: { order_seq: number | null; order_number: string }) =>
    o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
  const orderInfo = new Map(orders.map(o => [o.id, { label: labelOf(o), packing: o.status === 'packaging' }]));

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
      { productId: it.product_id, name: it.product_name, total: 0, stock: 0, orders: [] };
    row.total += qty;
    const ex = row.orders.find(o => o.id === it.order_id);
    if (ex) ex.qty += qty;
    else {
      const info = orderInfo.get(it.order_id);
      row.orders.push({ id: it.order_id, label: info?.label ?? `#${it.order_id}`, qty, packing: !!info?.packing });
    }
    byProduct.set(it.product_id, row);
  }

  // Current stock for the products in the list.
  const stockMap = await getStockMap([...byProduct.keys()]);
  for (const row of byProduct.values()) row.stock = stockMap[row.productId] ?? 0;

  const rows = [...byProduct.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const totalUnits = rows.reduce((s, r) => s + r.total, 0);
  const shortRows = rows.filter(r => r.total > r.stock);

  // Plain-text buy list for the Copy button (name ×qty, shortfall noted).
  const copyText = rows
    .map(r => {
      const short = r.total - r.stock;
      return `${r.name} ×${r.total}${short > 0 ? `  (have ${r.stock}, order ${short})` : ''}`;
    })
    .join('\n');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-display text-2xl sm:text-3xl font-light text-charcoal">To Order</h1>
        {rows.length > 0 && <ProcurementActions copyText={copyText} />}
      </div>
      <p className="text-sm text-mist mb-6">
        Items from <strong className="text-charcoal font-semibold">Payment verified</strong> and{' '}
        <strong className="text-charcoal font-semibold">Packing</strong> orders, totalled by product against current
        stock. Tap a product to see which orders need it. Test orders excluded.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone rounded-md p-10 text-center">
          Nothing to order — no payment-verified or packing orders right now.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-charcoal mb-5">
            <span><strong className="font-semibold">{rows.length}</strong> products</span>
            <span><strong className="font-semibold">{totalUnits}</strong> units total</span>
            <span><strong className="font-semibold">{orders.length}</strong> orders</span>
            {shortRows.length > 0 && (
              <span className="text-red-600"><strong className="font-semibold">{shortRows.length}</strong> short on stock</span>
            )}
          </div>

          {/* Interactive list (hidden when printing). */}
          <ul className="space-y-2 print:hidden">
            {rows.map(r => {
              const short = r.total - r.stock;
              return (
                <li key={r.productId}>
                  <details className="group bg-white border border-bone rounded-lg overflow-hidden">
                    <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none hover:bg-cream/50">
                      <ChevronRight size={14} className="text-mist shrink-0 transition-transform group-open:rotate-90" />
                      <span className="text-[11px] text-mist font-mono w-9 shrink-0">#{r.productId}</span>
                      <span className="flex-1 text-sm text-charcoal leading-snug">{r.name}</span>
                      <span
                        className={`text-[11px] whitespace-nowrap px-1.5 py-0.5 rounded ${
                          short > 0 ? 'bg-red-50 text-red-600 font-semibold' : 'text-mist'
                        }`}
                        title="Current stock"
                      >
                        stock {r.stock}
                      </span>
                      <span className="inline-flex items-center justify-center min-w-9 h-7 px-2 rounded-md bg-charcoal text-cream text-sm font-semibold tabular-nums">
                        ×{r.total}
                      </span>
                    </summary>
                    <div className="border-t border-bone bg-cream/30 px-4 sm:px-12 py-1">
                      {short > 0 && (
                        <p className="text-xs text-red-600 py-2">
                          Need {r.total}, have {r.stock} — order {short} more.
                        </p>
                      )}
                      <ul className="divide-y divide-bone/60">
                        {r.orders.map(o => (
                          <li key={o.id} className="flex items-center justify-between py-2 text-sm">
                            <Link href={`/manzura/orders/${o.id}`} className="text-gold-dark hover:underline">
                              {o.label}
                              {o.packing && <span className="text-[10px] text-amber-700 ml-1.5 uppercase tracking-wide">packing</span>}
                            </Link>
                            <span className="text-charcoal tabular-nums">×{o.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>

          {/* Print-only clean buy list. */}
          <table className="hidden print:table w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-charcoal text-left">
                <th className="py-1 pr-3">Product</th>
                <th className="py-1 px-3 text-right">Need</th>
                <th className="py-1 px-3 text-right">Stock</th>
                <th className="py-1 pl-3 text-right">Order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const short = Math.max(0, r.total - r.stock);
                return (
                  <tr key={r.productId} className="border-b border-bone">
                    <td className="py-1 pr-3">{r.name}</td>
                    <td className="py-1 px-3 text-right tabular-nums">{r.total}</td>
                    <td className="py-1 px-3 text-right tabular-nums">{r.stock}</td>
                    <td className="py-1 pl-3 text-right tabular-nums font-semibold">{short || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
