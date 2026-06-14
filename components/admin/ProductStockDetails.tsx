'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface Movement {
  id: number;
  delta: number;
  reason: string;
  created_at: string;
  note: string | null;
  company: string | null;
  order_ref: string | null;
}

interface RecentOrder {
  id: number;
  order_ref: string;
  quantity: number;
  status: string;
  customer_name: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

interface ProductData {
  currentStock: number;
  movements: Movement[];
  recentOrders: RecentOrder[];
}

const REASON_CLS: Record<string, string> = {
  inbound:        'text-emerald-700',
  order:          'text-rose-600',
  cancel_restock: 'text-amber-600',
  adjustment:     'text-stone-500',
};

const STATUS_CLS: Record<string, string> = {
  order_received:    'bg-stone-100 text-stone-600',
  payment_verified:  'bg-sky-50 text-sky-700',
  packaging:         'bg-amber-50 text-amber-700',
  shipped:           'bg-blue-50 text-blue-700',
  delivered:         'bg-emerald-50 text-emerald-700',
  cancelled:         'bg-rose-50 text-rose-700',
};

const TOOLTIP_STYLE = {
  fontSize: 11,
  border: '1px solid #e8e2d9',
  borderRadius: 6,
  background: '#fff',
};

function toKst(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function toKstShort(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

function kstDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso));
}

interface ChartSectionProps { title: string; children: React.ReactNode }
function ChartSection({ title, children }: ChartSectionProps) {
  return (
    <div className="bg-white border border-bone rounded p-4">
      <p className="text-[10px] uppercase tracking-widest text-mist mb-3">{title}</p>
      {children}
    </div>
  );
}

export default function ProductStockDetails({
  productId,
  option = '',
  productName,
}: {
  productId: number;
  option?: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    fetch(`/api/admin/stock/product/${productId}?option=${encodeURIComponent(option)}`)
      .then(r => r.json())
      .then((d: ProductData) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, productId, option, data]);

  // ── Chart data ────────────────────────────────────────────────────────────

  // 1. Stock level over time (cumulative reconstruction, chronological)
  const stockLevelChart = (() => {
    if (!data || data.movements.length === 0) return [];
    const chronological = [...data.movements].reverse();
    let level = data.currentStock - data.movements.reduce((s, m) => s + m.delta, 0);
    return chronological.map(m => {
      level += m.delta;
      return { date: toKstShort(m.created_at), stock: Math.max(0, level), fullDate: toKst(m.created_at) };
    }).slice(-60);
  })();

  // 2. Daily order volume — units sold per day (chronological)
  const orderVolumeChart = (() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const m of data.movements) {
      if (m.reason !== 'order') continue;
      const day = kstDayKey(m.created_at);
      map.set(day, (map.get(day) ?? 0) + Math.abs(m.delta));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, units]) => ({ date: day.slice(5), units })); // MM-DD
  })();

  // 3. Stock delta per movement (all types, chronological)
  const deltaChart = (() => {
    if (!data || data.movements.length === 0) return [];
    return [...data.movements]
      .reverse()
      .slice(-60)
      .map(m => ({
        date: toKstShort(m.created_at),
        delta: m.delta,
        reason: m.reason,
        fullDate: toKst(m.created_at),
      }));
  })();

  const totalSold = data
    ? data.movements.filter(m => m.reason === 'order').reduce((s, m) => s + Math.abs(m.delta), 0)
    : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[10px] px-2.5 py-1 border border-bone rounded text-mist hover:text-charcoal hover:border-charcoal transition-colors flex items-center gap-1"
      >
        <TrendingUp size={9} />
        Details
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative ml-auto bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl border-l border-bone">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-bone px-6 py-4 flex items-start justify-between z-10">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-mist mb-0.5">Product #{productId}</p>
                <h2 className="font-display text-xl font-light text-charcoal leading-tight">{productName}</h2>
              </div>
              <button onClick={() => setOpen(false)} className="text-mist hover:text-charcoal mt-0.5">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {loading && (
                <p className="text-sm text-mist text-center py-12">Loading…</p>
              )}

              {data && (
                <>
                  {/* KPI strip */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Current Stock</p>
                      <p className={`text-xl font-semibold ${data.currentStock === 0 ? 'text-rose-600' : data.currentStock <= 10 ? 'text-amber-600' : 'text-charcoal'}`}>
                        {data.currentStock}
                      </p>
                    </div>
                    <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Total Sold</p>
                      <p className="text-xl font-semibold text-charcoal">{totalSold}</p>
                    </div>
                    <div className="bg-cream/60 border border-bone rounded p-3 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-mist mb-1">Total Orders</p>
                      <p className="text-xl font-semibold text-charcoal">{data.recentOrders.length}</p>
                    </div>
                  </div>

                  {/* ── STATUS — 3 line charts ── */}
                  <div>
                    <p className="text-xs uppercase tracking-widest text-charcoal font-semibold mb-3 pb-2 border-b border-bone">
                      Status
                    </p>
                    <div className="space-y-4">

                      {/* Chart 1: Stock quantity over time */}
                      {stockLevelChart.length > 1 ? (
                        <ChartSection title="Stock Quantity">
                          <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={stockLevelChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip
                                contentStyle={TOOLTIP_STYLE}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={(v: any) => [`${v} units`, 'Stock']}
                              />
                              <Line type="monotone" dataKey="stock" stroke="#c9a96e" strokeWidth={2} dot={{ r: 2.5, fill: '#c9a96e', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartSection>
                      ) : (
                        <ChartSection title="Stock Quantity">
                          <p className="text-xs text-mist py-4 text-center">Not enough movement data yet.</p>
                        </ChartSection>
                      )}

                      {/* Chart 2: Daily order volume */}
                      {orderVolumeChart.length > 0 ? (
                        <ChartSection title="Daily Order Volume (units sold)">
                          <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={orderVolumeChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip
                                contentStyle={TOOLTIP_STYLE}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={(v: any) => [`${v} units`, 'Sold']}
                              />
                              <Line type="monotone" dataKey="units" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2.5, fill: '#38bdf8', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartSection>
                      ) : (
                        <ChartSection title="Daily Order Volume (units sold)">
                          <p className="text-xs text-mist py-4 text-center">No orders yet.</p>
                        </ChartSection>
                      )}

                      {/* Chart 3: Stock delta per movement */}
                      {deltaChart.length > 1 ? (
                        <ChartSection title="Stock Changes (Δ per movement)">
                          <ResponsiveContainer width="100%" height={150}>
                            <LineChart data={deltaChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e8e2d9" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 9, fill: '#6b6b6b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                              <ReferenceLine y={0} stroke="#e8e2d9" strokeWidth={1.5} />
                              <Tooltip
                                contentStyle={TOOLTIP_STYLE}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={(v: any) => [v > 0 ? `+${v}` : String(v), 'Δ']}
                              />
                              <Line
                                type="monotone"
                                dataKey="delta"
                                stroke="#a78bfa"
                                strokeWidth={2}
                                dot={{ r: 2.5, fill: '#a78bfa', strokeWidth: 0 }}
                                activeDot={{ r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartSection>
                      ) : (
                        <ChartSection title="Stock Changes (Δ per movement)">
                          <p className="text-xs text-mist py-4 text-center">Not enough movement data yet.</p>
                        </ChartSection>
                      )}
                    </div>
                  </div>

                  {/* Recent movements feed */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-mist mb-3">Recent Movements</p>
                    <div className="border border-bone rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-cream border-b border-bone">
                          <tr className="text-[9px] uppercase tracking-widest text-mist">
                            <th className="text-left px-3 py-2 font-semibold">Date</th>
                            <th className="text-right px-3 py-2 font-semibold">Δ</th>
                            <th className="text-left px-3 py-2 font-semibold">Reason</th>
                            <th className="text-left px-3 py-2 font-semibold">Ref</th>
                            <th className="text-left px-3 py-2 font-semibold">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.movements.slice(0, 30).map((m, i) => (
                            <tr key={m.id} className={`border-t border-bone ${i % 2 === 1 ? 'bg-cream/30' : ''}`}>
                              <td className="px-3 py-2 font-mono text-mist whitespace-nowrap">{toKst(m.created_at)}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${REASON_CLS[m.reason] ?? 'text-charcoal'}`}>
                                {m.delta >= 0 ? `+${m.delta}` : m.delta}
                              </td>
                              <td className="px-3 py-2 text-mist capitalize">{m.reason.replace('_', ' ')}</td>
                              <td className="px-3 py-2 text-mist">{m.order_ref ?? m.company ?? '—'}</td>
                              <td className="px-3 py-2 text-mist max-w-[100px] truncate">{m.note ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent orders */}
                  {data.recentOrders.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-mist mb-3">Orders Containing This Product</p>
                      <div className="border border-bone rounded overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-cream border-b border-bone">
                            <tr className="text-[9px] uppercase tracking-widest text-mist">
                              <th className="text-left px-3 py-2 font-semibold">Order</th>
                              <th className="text-center px-3 py-2 font-semibold">Qty</th>
                              <th className="text-left px-3 py-2 font-semibold">Customer</th>
                              <th className="text-left px-3 py-2 font-semibold">Status</th>
                              <th className="text-left px-3 py-2 font-semibold">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recentOrders.slice(0, 20).map((o, i) => (
                              <tr
                                key={o.id}
                                className={`border-t border-bone cursor-pointer hover:bg-cream/50 ${i % 2 === 1 ? 'bg-cream/30' : ''}`}
                                onClick={() => window.open(`/manzura/orders/${o.id}`, '_blank')}
                              >
                                <td className="px-3 py-2 font-mono text-charcoal">{o.order_ref}</td>
                                <td className="px-3 py-2 text-center text-charcoal">{o.quantity}</td>
                                <td className="px-3 py-2 text-mist max-w-[100px] truncate">{o.customer_name}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${STATUS_CLS[o.status] ?? 'bg-stone-100 text-stone-600'}`}>
                                    {o.status.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-mist whitespace-nowrap">{toKst(o.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
