import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import InboundForm from '@/components/admin/InboundForm';

export const dynamic = 'force-dynamic';

type Tab = 'stock' | 'movements' | 'add';

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const REASON_LABEL: Record<string, { label: string; cls: string }> = {
  inbound:        { label: 'Inbound',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  order:          { label: 'Order',         cls: 'bg-sky-50 text-sky-700 border-sky-200'             },
  cancel_restock: { label: 'Cancel +stock', cls: 'bg-amber-50 text-amber-700 border-amber-200'       },
  adjustment:     { label: 'Adjustment',    cls: 'bg-stone-50 text-stone-600 border-stone-200'       },
};

export default async function StockPage({ searchParams }: PageProps) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const { tab: rawTab } = await searchParams;
  const tab: Tab = rawTab === 'movements' ? 'movements' : rawTab === 'add' ? 'add' : 'stock';

  const supabase = createServiceClient();
  const allProducts = await getAllProducts();
  const productById = new Map(allProducts.map(p => [p.id, p.name as string]));

  const tabBar = (
    <div className="flex gap-2 mb-6">
      {(['stock', 'movements', 'add'] as const).map(v => (
        <Link
          key={v}
          href={`/manzura/stock${v === 'stock' ? '' : `?tab=${v}`}`}
          className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
            tab === v
              ? 'bg-charcoal text-cream border-charcoal'
              : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
          }`}
        >
          {v === 'stock' ? 'Stock' : v === 'movements' ? 'Movements' : 'Add Inbound'}
        </Link>
      ))}
    </div>
  );

  // ── STOCK TAB ─────────────────────────────────────────────────
  if (tab === 'stock') {
    const { data: stockRows } = await supabase
      .from('product_stock')
      .select('product_id, stock')
      .order('stock', { ascending: true });

    const rows = (stockRows ?? []) as Array<{ product_id: number; stock: number }>;
    // Merge with catalogue (include products that have no stock row).
    const allRows = allProducts.map(p => ({
      id: p.id,
      name: p.name as string,
      stock: rows.find(r => r.product_id === p.id)?.stock ?? 0,
    })).sort((a, b) => a.stock - b.stock);

    const outOfStock = allRows.filter(r => r.stock <= 0).length;
    const lowStock   = allRows.filter(r => r.stock > 0 && r.stock <= 3).length;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl font-light text-charcoal mb-6">Stock</h1>
        {tabBar}

        {/* Summary pills */}
        <div className="flex flex-wrap gap-3 mb-6">
          <span className="text-xs px-3 py-1 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
            {allRows.length} products
          </span>
          {outOfStock > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
              {outOfStock} sold out
            </span>
          )}
          {lowStock > 0 && (
            <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {lowStock} low stock (≤ 3)
            </span>
          )}
        </div>

        <div className="bg-white border border-bone rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream border-b border-bone">
              <tr className="text-[10px] uppercase tracking-widest text-mist">
                <th className="text-left px-4 py-3 font-semibold">ID</th>
                <th className="text-left px-4 py-3 font-semibold">Product</th>
                <th className="text-right px-4 py-3 font-semibold">Stock</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {allRows.map(r => {
                const isOut = r.stock <= 0;
                const isLow = !isOut && r.stock <= 3;
                return (
                  <tr key={r.id} className="border-t border-bone hover:bg-cream/50">
                    <td className="px-4 py-2.5 text-xs text-mist font-mono">#{r.id}</td>
                    <td className="px-4 py-2.5 text-charcoal">{r.name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-charcoal">{r.stock}</td>
                    <td className="px-4 py-2.5">
                      {isOut ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          Sold out
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Low
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/manzura/products/${r.id}`}
                        className="text-xs text-gold-dark hover:text-gold underline underline-offset-2"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── MOVEMENTS TAB ─────────────────────────────────────────────
  if (tab === 'movements') {
    const { data: movRows } = await supabase
      .from('stock_movements')
      .select('id, product_id, delta, reason, company_id, order_id, note, created_at, companies(name), orders(order_seq, order_number)')
      .order('created_at', { ascending: false })
      .limit(200);

    const movements = (movRows ?? []) as unknown as Array<{
      id: number;
      product_id: number;
      delta: number;
      reason: string;
      company_id: number | null;
      order_id: number | null;
      note: string | null;
      created_at: string;
      companies: { name: string } | null;
      orders: { order_seq: number | null; order_number: string } | null;
    }>;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl font-light text-charcoal mb-6">Stock</h1>
        {tabBar}

        {movements.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone p-8 text-center rounded">
            No movements recorded yet. Add inbound stock or cancel an order to see entries here.
          </p>
        ) : (
          <div className="bg-white border border-bone rounded overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-cream border-b border-bone">
                <tr className="text-[10px] uppercase tracking-widest text-mist">
                  <th className="text-left px-4 py-3 font-semibold">Date (KST)</th>
                  <th className="text-left px-4 py-3 font-semibold">Product</th>
                  <th className="text-right px-4 py-3 font-semibold">Δ Qty</th>
                  <th className="text-left px-4 py-3 font-semibold">Reason</th>
                  <th className="text-left px-4 py-3 font-semibold">Supplier / Order</th>
                  <th className="text-left px-4 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => {
                  const kst = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Seoul',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false,
                  }).format(new Date(m.created_at));

                  const productName = productById.get(m.product_id) ?? `#${m.product_id}`;
                  const reasonMeta = REASON_LABEL[m.reason] ?? { label: m.reason, cls: 'bg-bone text-mist border-bone' };

                  let ref = '—';
                  if (m.companies?.name) ref = m.companies.name;
                  if (m.orders) {
                    const seq = m.orders.order_seq;
                    const num = seq != null ? `SGL-${String(seq).padStart(4, '0')}` : m.orders.order_number;
                    ref = num;
                  }

                  return (
                    <tr key={m.id} className="border-t border-bone hover:bg-cream/50">
                      <td className="px-4 py-2.5 text-xs font-mono text-mist whitespace-nowrap">{kst}</td>
                      <td className="px-4 py-2.5 text-charcoal text-xs max-w-[180px] truncate">{productName}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${m.delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {m.delta >= 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${reasonMeta.cls}`}>
                          {reasonMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-mist">{ref}</td>
                      <td className="px-4 py-2.5 text-xs text-mist max-w-[160px] truncate">{m.note ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── ADD TAB ───────────────────────────────────────────────────
  const { data: companyRows } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');
  const companies = (companyRows ?? []) as Array<{ id: number; name: string }>;

  const products = allProducts.map(p => ({ id: p.id, name: p.name as string }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">Stock</h1>
      {tabBar}
      <InboundForm products={products} companies={companies} />
    </div>
  );
}
