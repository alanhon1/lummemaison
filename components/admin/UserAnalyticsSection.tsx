'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface AnalyticsOrderItem {
  product_name: string;
  quantity: number;
  line_cents: number;
}

export interface AnalyticsOrder {
  id: number;
  total_cents: number;
  created_at: string;
  status: string;
  items: AnalyticsOrderItem[];
}

type Period = 'day' | 'week' | 'month' | 'all';

// KST sortable key: "2025-01"
function kstMonthKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso));
}

// Display label: "Jan '25"
function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleString('en-US', { month: 'short' }) + " '" + y.slice(2);
}

function formatUSD(cents: number): string {
  return '$' + Math.round(cents / 100).toLocaleString('en-US');
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-bone rounded-sm p-4">
      <p className="text-[10px] uppercase tracking-widest text-mist mb-1">{label}</p>
      <p className="text-lg font-semibold text-charcoal leading-tight">{value}</p>
    </div>
  );
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

export default function UserAnalyticsSection({ orders }: { orders: AnalyticsOrder[] }) {
  const [period, setPeriod] = useState<Period>('month');

  const cutoff = useMemo<Date | null>(() => {
    const now = new Date();
    if (period === 'day') {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (period === 'week') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (period === 'month') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return null;
  }, [period]);

  const filtered = useMemo(
    () =>
      orders.filter(
        o => o.status !== 'cancelled' && (!cutoff || new Date(o.created_at) >= cutoff),
      ),
    [orders, cutoff],
  );

  const totalOrders = filtered.length;
  const totalSpentCents = filtered.reduce((s, o) => s + o.total_cents, 0);
  const avgOrderCents = totalOrders > 0 ? totalSpentCents / totalOrders : 0;
  const lastOrderDate = filtered.length > 0
    ? new Date(Math.max(...filtered.map(o => new Date(o.created_at).getTime())))
    : null;

  const monthlySpend = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of filtered) {
      const key = kstMonthKey(o.created_at);
      map.set(key, (map.get(key) ?? 0) + o.total_cents / 100);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, total]) => ({ month: monthLabel(key), total: Math.round(total) }));
  }, [filtered]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; rev: number }>();
    for (const o of filtered) {
      for (const item of o.items) {
        const e = map.get(item.product_name) ?? { qty: 0, rev: 0 };
        map.set(item.product_name, { qty: e.qty + item.quantity, rev: e.rev + item.line_cents / 100 });
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 5)
      .map(([name, { qty }]) => ({
        name: name.length > 26 ? name.slice(0, 24) + '…' : name,
        qty,
      }));
  }, [filtered]);

  if (orders.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-light text-charcoal">Analytics</h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-xs px-3 py-1 rounded border transition-colors ${
                period === p.value
                  ? 'bg-charcoal text-cream border-charcoal'
                  : 'text-mist border-bone hover:border-charcoal hover:text-charcoal'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Orders" value={String(totalOrders)} />
        <StatCard label="Total Spent" value={formatUSD(totalSpentCents)} />
        <StatCard label="Avg Order" value={formatUSD(avgOrderCents)} />
        <StatCard
          label="Last Order"
          value={lastOrderDate ? lastOrderDate.toLocaleDateString() : '—'}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone p-6 text-center">
          No data for this period.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Spending trend (only if ≥2 months of data) */}
          {monthlySpend.length >= 1 && (
            <div className="bg-white border border-bone rounded-sm p-4">
              <p className="text-[10px] uppercase tracking-widest text-mist mb-3">
                Spending Trend
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlySpend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c9a96e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c9a96e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#6b6b6b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#6b6b6b' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip
                    formatter={(v) => [`$${Number(v).toLocaleString()}`, 'Spent']}
                    contentStyle={{ fontSize: 12, border: '1px solid #e8e2d9', borderRadius: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#a8874a"
                    strokeWidth={2}
                    fill="url(#goldGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top products by qty */}
          {topProducts.length > 0 && (
            <div className="bg-white border border-bone rounded-sm p-4">
              <p className="text-[10px] uppercase tracking-widest text-mist mb-3">
                Top Products (by qty)
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: '#6b6b6b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#6b6b6b' }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v) => [Number(v), 'Units']}
                    contentStyle={{ fontSize: 12, border: '1px solid #e8e2d9', borderRadius: 4 }}
                  />
                  <Bar dataKey="qty" fill="#c9a96e" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
