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
  date: string;
  qty: number;
}
interface Row {
  productId: number;
  name: string;
  total: number;
  stock: number;
  orders: OrderRef[];
}
interface OrderGroup {
  id: number;
  label: string;
  date: string;
  items: Array<{ name: string; qty: number }>;
}

// "To Order" — what (and how many) to order from suppliers. Two views over the
// same Payment-verified orders (test orders excluded): a per-product buy list
// (against current stock) and a per-order grouping. Dates shown in KST.
// `?filter=short` narrows the buy list to products short on stock.
export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');
  const shortOnly = (await searchParams).filter === 'short';

  const supabase = createServiceClient();

  const { data: ordersData } = await supabase
    .from('orders')
    .select('id, order_seq, order_number, created_at')
    .eq('status', 'payment_verified')
    .not('order_number', 'ilike', 'TEST-%')
    .order('created_at', { ascending: false });

  const orders = (ordersData ?? []) as Array<{
    id: number;
    order_seq: number | null;
    order_number: string;
    created_at: string;
  }>;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const labelOf = (o: { order_seq: number | null; order_number: string }) =>
    o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number;
  const orderInfo = new Map(orders.map(o => [o.id, { label: labelOf(o), date: fmtDate(o.created_at) }]));

  const ids = orders.map(o => o.id);
  let items: Array<{ order_id: number; product_id: number; product_name: string; quantity: number }> = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from('order_items')
      .select('order_id, product_id, product_name, quantity')
      .in('order_id', ids);
    items = (data ?? []) as typeof items;
  }

  // Per-product aggregate (with which orders need it).
  const byProduct = new Map<number, Row>();
  // Per-order grouping (in the orders' display order — newest first).
  const byOrder = new Map<number, OrderGroup>();
  for (const o of orders) {
    const info = orderInfo.get(o.id)!;
    byOrder.set(o.id, { id: o.id, label: info.label, date: info.date, items: [] });
  }
  for (const it of items) {
    const qty = it.quantity ?? 0;
    const info = orderInfo.get(it.order_id);
    const row =
      byProduct.get(it.product_id) ??
      { productId: it.product_id, name: it.product_name, total: 0, stock: 0, orders: [] };
    row.total += qty;
    const ex = row.orders.find(r => r.id === it.order_id);
    if (ex) ex.qty += qty;
    else row.orders.push({ id: it.order_id, label: info?.label ?? `#${it.order_id}`, date: info?.date ?? '', qty });
    byProduct.set(it.product_id, row);

    byOrder.get(it.order_id)?.items.push({ name: it.product_name, qty });
  }

  const stockMap = await getStockMap([...byProduct.keys()]);
  for (const row of byProduct.values()) row.stock = stockMap[row.productId] ?? 0;

  const rows = [...byProduct.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const orderGroups = [...byOrder.values()];
  const totalUnits = rows.reduce((s, r) => s + r.total, 0);
  const shortRows = rows.filter(r => r.total > r.stock);
  const visibleRows = shortOnly ? shortRows : rows;

  const copyText = visibleRows
    .map(r => {
      const short = r.total - r.stock;
      return `${r.name} ×${r.total}${short > 0 ? `  (have ${r.stock}, order ${short})` : ''}`;
    })
    .join('\n');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="font-display text-2xl sm:text-3xl font-light text-charcoal">Items in Orders</h1>
        {rows.length > 0 && <ProcurementActions copyText={copyText} />}
      </div>
      <p className="text-sm text-mist mb-6">
        Items from <strong className="text-charcoal font-semibold">Payment verified</strong> orders only, against
        current stock. Test orders excluded.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone rounded-md p-10 text-center">
          Nothing to order — no payment-verified orders right now.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-charcoal mb-6">
            <span><strong className="font-semibold">{rows.length}</strong> products</span>
            <span><strong className="font-semibold">{totalUnits}</strong> units total</span>
            <span><strong className="font-semibold">{orders.length}</strong> orders</span>
            {shortRows.length > 0 && (
              <span className="text-red-600"><strong className="font-semibold">{shortRows.length}</strong> short on stock</span>
            )}
          </div>

          {/* ── By product (buy list) ───────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 mb-2 print:hidden">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-mist">By product</h2>
            <div className="flex gap-1 text-[11px] font-semibold uppercase tracking-wider">
              <Link
                href="/manzura/procurement"
                className={`px-2.5 py-1 rounded ${!shortOnly ? 'bg-charcoal text-cream' : 'text-mist hover:text-charcoal'}`}
              >
                All
              </Link>
              <Link
                href="/manzura/procurement?filter=short"
                className={`px-2.5 py-1 rounded ${shortOnly ? 'bg-red-600 text-white' : 'text-mist hover:text-charcoal'}`}
              >
                Short only{shortRows.length > 0 ? ` (${shortRows.length})` : ''}
              </Link>
            </div>
          </div>
          {visibleRows.length === 0 ? (
            <p className="text-sm text-mist border border-dashed border-bone rounded-md p-6 text-center print:hidden">
              No products short on stock. 🎉
            </p>
          ) : (
          <ul className="space-y-2 print:hidden">
            {visibleRows.map(r => {
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
                        <p className="text-xs text-red-600 py-2">Need {r.total}, have {r.stock} — order {short} more.</p>
                      )}
                      <ul className="divide-y divide-bone/60">
                        {r.orders.map(o => (
                          <li key={o.id} className="flex items-center justify-between py-2 text-sm gap-3">
                            <Link href={`/manzura/orders/${o.id}`} className="text-gold-dark hover:underline">
                              {o.label}
                            </Link>
                            <span className="flex items-center gap-3 whitespace-nowrap">
                              <span className="text-[11px] text-mist">{o.date}</span>
                              <span className="text-charcoal tabular-nums">×{o.qty}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          )}

          {/* ── By order ────────────────────────────────────────────── */}
          <h2 className="text-xs font-semibold tracking-widest uppercase text-mist mt-8 mb-2 print:hidden">By order</h2>
          <ul className="space-y-2 print:hidden">
            {orderGroups.map(g => (
              <li key={g.id} className="bg-white border border-bone rounded-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-bone bg-cream/40">
                  <Link href={`/manzura/orders/${g.id}`} className="text-sm font-semibold text-gold-dark hover:underline">
                    {g.label}
                  </Link>
                  <span className="text-[11px] text-mist whitespace-nowrap">{g.date}</span>
                </div>
                <ul className="divide-y divide-bone/60 px-4">
                  {g.items.map((it, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm gap-3">
                      <span className="text-charcoal leading-snug">{it.name}</span>
                      <span className="text-charcoal tabular-nums whitespace-nowrap">×{it.qty}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
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
              {visibleRows.map(r => {
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
