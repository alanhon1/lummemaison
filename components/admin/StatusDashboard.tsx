'use client';

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export interface DailyPoint {
  date: string;
  label: string;
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
  order_received:   '#f59e0b',
  payment_verified: '#38bdf8',
  packaging:        '#818cf8',
  shipped:          '#34d399',
  delivered:        '#c9a96e',
  cancelled:        '#a8a29e',
};

const TOOLTIP_STYLE = {
  fontSize: 11,
  border: '1px solid #e8e2d9',
  borderRadius: 6,
  background: '#fff',
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
  const activeStatusCounts = statusCounts.filter(s => s.count > 0);

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total orders" value={String(totalOrders)} sub="all time" />
        <StatCard label="Orders today" value={String(ordersToday)} sub="since 00:00 UTC" />
        <StatCard label="Gross order value" value={money(revenueCents30)} sub="last 30 days" />
        <StatCard label="Avg order value" value={money(avgOrderCents)} sub="last 30 days" />
      </div>

      {/* Daily orders — line chart */}
      <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="font-display text-lg text-charcoal">Daily orders</h2>
          <span className="text-[10px] uppercase tracking-widest text-mist">last 30 days</span>
        </div>
        {daily.every(d => d.count === 0) ? (
          <p className="text-xs text-mist py-8 text-center">No orders in this window yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#6b6b6b' }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(daily.length / 5)}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#6b6b6b' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any, _: any, entry: any) => [
                  `${val} orders · ${money(entry?.payload?.revenueCents ?? 0)}`,
                  '',
                ]}
                labelStyle={{ fontWeight: 600, marginBottom: 2 }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#c9a96e"
                strokeWidth={2}
                dot={{ r: 3, fill: '#c9a96e', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status distribution */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
          <h2 className="font-display text-lg text-charcoal mb-5">Orders by status</h2>
          {activeStatusCounts.length === 0 ? (
            <p className="text-xs text-mist py-8 text-center">No orders yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={statusCounts}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 9, fill: '#6b6b6b' }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 10, fill: '#1a1a1a' }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any) => [`${val} orders`, '']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {statusCounts.map(s => (
                      <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? '#c9a96e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
                {statusCounts.map(s => (
                  <div key={s.status} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: STATUS_COLOR[s.status] ?? '#c9a96e' }}
                    />
                    <span className="text-[10px] text-mist">{s.label}</span>
                    <span className="text-[10px] font-semibold text-charcoal">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Top products */}
        <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
          <h2 className="font-display text-lg text-charcoal mb-5">Top products</h2>
          {topProducts.length === 0 ? (
            <p className="text-xs text-mist py-8 text-center">No sales recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: '#6b6b6b' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#1a1a1a' }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 15) + '…' : v}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [`${val} units sold`, '']}
                />
                <Bar dataKey="quantity" fill="#c9a96e" radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
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
