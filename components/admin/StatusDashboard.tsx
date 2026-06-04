// Presentational analytics dashboard for /manzura/status. Pure component (no
// hooks, no 'use client') — rendered on the server with data computed in the
// page. Charts are lightweight CSS/flex bars so there's no charting dependency.

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Jun 4"
  count: number;
  revenueCents: number;
}

export interface StatusCount {
  status: string;
  label: string;
  count: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
}

export interface LowStockItem {
  id: number;
  name: string;
  stock: number;
}

interface Props {
  totalOrders: number;
  ordersToday: number;
  revenueCents30: number;
  avgOrderCents: number;
  daily: DailyPoint[];
  statusCounts: StatusCount[];
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

const STATUS_COLOR: Record<string, string> = {
  order_received: 'bg-amber-400',
  payment_verified: 'bg-sky-400',
  packaging: 'bg-indigo-400',
  shipped: 'bg-emerald-400',
  delivered: 'bg-gold',
  cancelled: 'bg-stone-400',
};

export default function StatusDashboard({
  totalOrders,
  ordersToday,
  revenueCents30,
  avgOrderCents,
  daily,
  statusCounts,
  topProducts,
  lowStock,
}: Props) {
  const maxDaily = Math.max(1, ...daily.map(d => d.count));
  const maxStatus = Math.max(1, ...statusCounts.map(s => s.count));
  const maxTop = Math.max(1, ...topProducts.map(p => p.quantity));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <h1 className="font-display text-3xl font-light text-charcoal">Analytics</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total orders" value={String(totalOrders)} sub="all time" />
        <StatCard label="Orders today" value={String(ordersToday)} sub="since 00:00 UTC" />
        <StatCard label="Gross order value" value={money(revenueCents30)} sub="last 30 days" />
        <StatCard label="Avg order value" value={money(avgOrderCents)} sub="last 30 days" />
      </div>

      {/* Daily orders */}
      <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-lg text-charcoal">Daily orders</h2>
          <span className="text-[10px] uppercase tracking-widest text-mist">last 30 days</span>
        </div>
        {daily.every(d => d.count === 0) ? (
          <p className="text-xs text-mist py-8 text-center">No orders in this window yet.</p>
        ) : (
          <div className="flex items-end gap-[3px] h-40">
            {daily.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group" title={`${d.label}: ${d.count} order${d.count === 1 ? '' : 's'} · ${money(d.revenueCents)}`}>
                <div
                  className="w-full bg-gold/70 group-hover:bg-gold rounded-t-sm transition-colors"
                  style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
        )}
        {/* sparse x labels: first, mid, last */}
        <div className="flex justify-between mt-2 text-[9px] text-mist">
          <span>{daily[0]?.label}</span>
          <span>{daily[Math.floor(daily.length / 2)]?.label}</span>
          <span>{daily[daily.length - 1]?.label}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status distribution */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
          <h2 className="font-display text-lg text-charcoal mb-5">Orders by status</h2>
          <div className="space-y-3">
            {statusCounts.map(s => (
              <div key={s.status}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-charcoal">{s.label}</span>
                  <span className="text-mist">{s.count}</span>
                </div>
                <div className="h-2 bg-cream rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${STATUS_COLOR[s.status] ?? 'bg-gold'}`}
                    style={{ width: `${(s.count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Top products */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
          <h2 className="font-display text-lg text-charcoal mb-5">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-xs text-mist py-8 text-center">No sales recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map(p => (
                <div key={p.name}>
                  <div className="flex justify-between text-xs mb-1 gap-3">
                    <span className="text-charcoal truncate">{p.name}</span>
                    <span className="text-mist whitespace-nowrap">{p.quantity} sold</span>
                  </div>
                  <div className="h-2 bg-cream rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gold-dark" style={{ width: `${(p.quantity / maxTop) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Low stock */}
      <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-lg text-charcoal">Low / out of stock</h2>
          <span className="text-[10px] uppercase tracking-widest text-mist">≤ 2 units</span>
        </div>
        {lowStock.length === 0 ? (
          <p className="text-xs text-mist py-4 text-center">Everything is well stocked.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            {lowStock.map(item => (
              <a
                key={item.id}
                href={`/manzura/products/${item.id}`}
                className="flex justify-between items-center text-xs py-1.5 border-b border-bone last:border-0 hover:text-gold-dark"
              >
                <span className="text-charcoal truncate mr-3">#{item.id} {item.name}</span>
                <span className={item.stock <= 0 ? 'text-rose-700 font-semibold whitespace-nowrap' : 'text-rose-600 whitespace-nowrap'}>
                  {item.stock <= 0 ? 'Sold out' : `${item.stock} left`}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-bone rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-widest text-mist">{label}</div>
      <div className="font-display text-2xl text-charcoal mt-1">{value}</div>
      <div className="text-[10px] text-mist mt-0.5">{sub}</div>
    </div>
  );
}
