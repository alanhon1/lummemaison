'use client';

import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export interface DailyPoint   { date: string; label: string; count: number; revenueCents: number; }
export interface StatusCount  { status: string; label: string; count: number; }
export interface TopProduct   { name: string; quantity: number; }
export interface LowStockItem { id: number; name: string; stock: number; }
export interface MonthlyPoint { month: string; label: string; revenueCents: number; count: number; }
export interface CountryCount { country: string; count: number; revenueCents: number; }
export interface PaymentMethodCount { method: string; count: number; revenueCents: number; }
export interface HourPoint    { hour: number; label: string; count: number; }
export interface DayPoint     { day: number; label: string; count: number; }

interface Props {
  totalOrders: number;
  ordersToday: number;
  revenueCents30: number;
  avgOrderCents: number;
  daily: DailyPoint[];
  statusCounts: StatusCount[];
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  monthly: MonthlyPoint[];
  countries: CountryCount[];
  paymentMethods: PaymentMethodCount[];
  hourly: HourPoint[];
  daily_dow: DayPoint[];
}

function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
function compact(cents: number): string {
  const v = cents / 100;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

const STATUS_COLOR: Record<string, string> = {
  order_received:   '#f59e0b',
  payment_verified: '#38bdf8',
  packaging:        '#818cf8',
  shipped:          '#34d399',
  delivered:        '#c9a96e',
  cancelled:        '#e2d9cc',
};

const TT: React.CSSProperties = {
  fontSize: 11,
  border: '1px solid #ede8e1',
  borderRadius: 8,
  background: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  padding: '6px 10px',
};

export default function StatusDashboard({
  totalOrders, ordersToday, revenueCents30, avgOrderCents,
  daily, statusCounts, topProducts, lowStock,
  monthly, countries, paymentMethods, hourly, daily_dow,
}: Props) {
  const totalPM = paymentMethods.reduce((s, p) => s + p.count, 0);
  const activeStatus = statusCounts.filter(s => s.count > 0);
  const peakHour = hourly.reduce((a, b) => b.count > a.count ? b : a, hourly[0]);
  const peakDay  = daily_dow.reduce((a, b) => b.count > a.count ? b : a, daily_dow[0]);
  const maxHour  = Math.max(...hourly.map(h => h.count), 1);
  const maxDay   = Math.max(...daily_dow.map(d => d.count), 1);

  return (
    <div className="space-y-5">

      {/* ── KPI cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Total orders"    value={String(totalOrders)}     sub="all time" />
        <KPI label="Orders today"    value={String(ordersToday)}     sub="since 00:00 UTC" />
        <KPI label="Revenue 30d"     value={money(revenueCents30)}   sub="non-cancelled" />
        <KPI label="Avg order value" value={money(avgOrderCents)}    sub="last 30 days" />
      </div>

      {/* ── Daily revenue area chart ─────────────────────────── */}
      <Panel title="Revenue" sub="last 30 days">
        {daily.every(d => d.revenueCents === 0) ? (
          <Empty>No orders in this window yet.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#c9a96e" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#c9a96e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#b0a898' }}
                tickLine={false} axisLine={false}
                interval={Math.floor(daily.length / 6)}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#b0a898' }}
                tickLine={false} axisLine={false}
                tickFormatter={compact}
              />
              <Tooltip
                contentStyle={TT}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, _: any, e: any) => [`${money(v as number)} · ${e?.payload?.count ?? 0} orders`, '']}
                labelStyle={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}
              />
              <Area
                type="monotone" dataKey="revenueCents"
                stroke="#c9a96e" strokeWidth={1.5}
                fill="url(#gRev)" dot={false}
                activeDot={{ r: 4, fill: '#c9a96e', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* ── Time analysis ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Hour of day */}
        <Panel title="Orders by hour" sub={`peak ${peakHour.label} · last 30 days`}>
          {hourly.every(h => h.count === 0) ? <Empty>No data yet.</Empty> : (
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={hourly} margin={{ top: 4, right: 0, left: -24, bottom: 0 }} barCategoryGap="20%">
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 8, fill: '#b0a898' }}
                  tickLine={false} axisLine={false}
                  interval={5}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={TT}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v} orders`, '']}
                  labelStyle={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={7}>
                  {hourly.map(h => (
                    <Cell
                      key={h.hour}
                      fill={h.count === maxHour ? '#c9a96e' : h.count > maxHour * 0.6 ? '#dcc08d' : '#ede8e1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Day of week */}
        <Panel title="Orders by day" sub={`peak ${peakDay.label} · last 30 days`}>
          {daily_dow.every(d => d.count === 0) ? <Empty>No data yet.</Empty> : (
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={daily_dow} margin={{ top: 4, right: 0, left: -24, bottom: 0 }} barCategoryGap="25%">
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#b0a898' }}
                  tickLine={false} axisLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={TT}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${v} orders`, '']}
                  labelStyle={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={20}>
                  {daily_dow.map(d => (
                    <Cell
                      key={d.day}
                      fill={d.count === maxDay ? '#c9a96e' : d.count > maxDay * 0.6 ? '#dcc08d' : '#ede8e1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* ── Status + Top products ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <Panel title="Orders by status">
          {activeStatus.length === 0 ? <Empty>No orders yet.</Empty> : (
            <>
              <div className="space-y-2 mt-1">
                {statusCounts.filter(s => s.count > 0).map(s => {
                  const total = activeStatus.reduce((a, b) => a + b.count, 0);
                  const pct = total > 0 ? (s.count / total) * 100 : 0;
                  return (
                    <div key={s.status}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[11px] text-charcoal">{s.label}</span>
                        <span className="text-[11px] font-medium text-charcoal tabular-nums">{s.count}</span>
                      </div>
                      <div className="h-1 w-full bg-bone rounded-full overflow-hidden">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{ width: `${pct}%`, background: STATUS_COLOR[s.status] ?? '#c9a96e' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-bone">
                {statusCounts.map(s => (
                  <div key={s.status} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[s.status] ?? '#c9a96e' }} />
                    <span className="text-[10px] text-mist">{s.label}</span>
                    <span className="text-[10px] font-semibold text-charcoal">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Top products" sub="all time by units sold">
          {topProducts.length === 0 ? <Empty>No sales recorded yet.</Empty> : (
            <div className="space-y-1.5 mt-1">
              {topProducts.map((p, i) => {
                const max = topProducts[0].quantity;
                const pct = max > 0 ? (p.quantity / max) * 100 : 0;
                return (
                  <div key={p.name} className="flex items-center gap-3">
                    <span className="text-[10px] text-mist w-4 shrink-0 tabular-nums text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[11px] text-charcoal truncate pr-2">{p.name}</span>
                        <span className="text-[11px] font-medium text-charcoal tabular-nums shrink-0">{p.quantity}</span>
                      </div>
                      <div className="h-0.5 w-full bg-bone rounded-full">
                        <div className="h-0.5 rounded-full bg-gold/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Monthly revenue area chart ────────────────────────── */}
      <Panel title="Monthly revenue" sub="last 12 months">
        {monthly.every(m => m.revenueCents === 0) ? <Empty>No revenue recorded yet.</Empty> : (
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={monthly} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gMon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#818cf8" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: '#b0a898' }}
                tickLine={false} axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#b0a898' }}
                tickLine={false} axisLine={false}
                tickFormatter={compact}
              />
              <Tooltip
                contentStyle={TT}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, _: any, e: any) => [`${money(v as number)} · ${e?.payload?.count ?? 0} orders`, '']}
                labelStyle={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}
              />
              <Area
                type="monotone" dataKey="revenueCents"
                stroke="#818cf8" strokeWidth={1.5}
                fill="url(#gMon)" dot={false}
                activeDot={{ r: 4, fill: '#818cf8', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* ── Country + Payment ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <Panel title="Orders by country" sub="top 10 · all time">
          {countries.length === 0 ? <Empty>No orders yet.</Empty> : (
            <div className="space-y-1.5 mt-1">
              {countries.map((c, i) => {
                const max = countries[0].count;
                const pct = max > 0 ? (c.count / max) * 100 : 0;
                return (
                  <div key={c.country} className="flex items-center gap-3">
                    <span className="text-[10px] text-mist w-4 shrink-0 tabular-nums text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[11px] text-charcoal">{c.country}</span>
                        <span className="text-[11px] text-mist tabular-nums">{c.count} · {money(c.revenueCents)}</span>
                      </div>
                      <div className="h-0.5 w-full bg-bone rounded-full">
                        <div className="h-0.5 rounded-full bg-indigo-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Payment methods">
          {paymentMethods.length === 0 ? <Empty>No orders yet.</Empty> : (
            <div className="space-y-4 mt-1">
              {paymentMethods.map(pm => {
                const pct = totalPM > 0 ? Math.round((pm.count / totalPM) * 100) : 0;
                const label = pm.method === 'wise' ? 'Wise' : pm.method === 'usdt' ? 'USDT' : pm.method ?? 'Unknown';
                return (
                  <div key={pm.method}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm font-medium text-charcoal">{label}</span>
                      <span className="text-[11px] text-mist tabular-nums">{pm.count} orders · {money(pm.revenueCents)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-bone rounded-full overflow-hidden">
                        <div className="h-1 rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-mist tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Low stock ─────────────────────────────────────────── */}
      <Panel title="Low / out of stock" sub="≤ 2 units">
        {lowStock.length === 0 ? (
          <p className="text-xs text-mist py-2">Everything is well stocked.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-1">
            {lowStock.map(item => (
              <a
                key={item.id}
                href={`/manzura/products/${item.id}`}
                className="flex justify-between items-center text-xs py-1.5 border-b border-bone last:border-0 hover:text-gold transition-colors"
              >
                <span className="text-charcoal truncate mr-3">#{item.id} {item.name}</span>
                <span className={item.stock <= 0 ? 'text-rose-600 font-semibold whitespace-nowrap' : 'text-amber-600 whitespace-nowrap'}>
                  {item.stock <= 0 ? 'Sold out' : `${item.stock} left`}
                </span>
              </a>
            ))}
          </div>
        )}
      </Panel>

    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-bone rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-[13px] font-semibold text-charcoal tracking-tight">{title}</h2>
        {sub && <span className="text-[10px] text-mist">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-bone rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-mist mb-1">{label}</div>
      <div className="text-2xl font-semibold text-charcoal tabular-nums">{value}</div>
      <div className="text-[10px] text-mist mt-0.5">{sub}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-mist py-6 text-center">{children}</p>;
}
