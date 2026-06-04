import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import StatusDashboard, {
  type DailyPoint,
  type StatusCount,
  type TopProduct,
  type LowStockItem,
} from '@/components/admin/StatusDashboard';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 2;

// Canonical status order + admin labels (mirrors AdminOrderStatusPanel).
const STATUS_LABELS: Array<{ status: string; label: string }> = [
  { status: 'order_received', label: 'Received' },
  { status: 'payment_verified', label: 'Payment verified' },
  { status: 'packaging', label: 'Packing' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'cancelled', label: 'Cancelled' },
];

export default async function StatusPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();

  // 30-day window for the time series (UTC, matching how orders are stored).
  const now = new Date();
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since30 = new Date(startToday);
  since30.setUTCDate(since30.getUTCDate() - 29);

  const [allStatusRes, windowRes, itemsRes, lowStockRes] = await Promise.all([
    supabase.from('orders').select('status'),
    supabase
      .from('orders')
      .select('created_at, total_cents')
      .gte('created_at', since30.toISOString()),
    supabase.from('order_items').select('product_name, quantity').limit(10000),
    supabase
      .from('product_stock')
      .select('product_id, stock')
      .lte('stock', LOW_STOCK_THRESHOLD)
      .order('stock', { ascending: true })
      .limit(60),
  ]);

  const allStatus = allStatusRes.data ?? [];
  const windowOrders = windowRes.data ?? [];
  const items = itemsRes.data ?? [];
  const lowStockRows = lowStockRes.data ?? [];

  // --- Status distribution (all time) ---
  const statusCounts: StatusCount[] = STATUS_LABELS.map(({ status, label }) => ({
    status,
    label,
    count: allStatus.filter(o => o.status === status).length,
  }));
  const totalOrders = allStatus.length;

  // --- Daily buckets (last 30 days) ---
  const buckets: DailyPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since30);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      date: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      count: 0,
      revenueCents: 0,
    });
  }
  const bucketByDate = new Map(buckets.map(b => [b.date, b]));
  let revenueCents30 = 0;
  let ordersToday = 0;
  const startTodayKey = startToday.toISOString().slice(0, 10);
  for (const o of windowOrders) {
    const key = String(o.created_at).slice(0, 10);
    const b = bucketByDate.get(key);
    if (b) {
      b.count += 1;
      b.revenueCents += o.total_cents ?? 0;
    }
    revenueCents30 += o.total_cents ?? 0;
    if (key === startTodayKey) ordersToday += 1;
  }
  const avgOrderCents = windowOrders.length > 0 ? Math.round(revenueCents30 / windowOrders.length) : 0;

  // --- Top products (all time, by quantity) ---
  const qtyByName = new Map<string, number>();
  for (const it of items) {
    const name = it.product_name ?? 'Unknown';
    qtyByName.set(name, (qtyByName.get(name) ?? 0) + (it.quantity ?? 0));
  }
  const topProducts: TopProduct[] = [...qtyByName.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  // --- Low stock (with names from the product catalogue) ---
  const allProducts = await getAllProducts();
  const nameById = new Map(allProducts.map(p => [p.id, p.name]));
  const lowStock: LowStockItem[] = lowStockRows.map(r => ({
    id: r.product_id,
    name: nameById.get(r.product_id) ?? `Product ${r.product_id}`,
    stock: r.stock,
  }));

  return (
    <StatusDashboard
      totalOrders={totalOrders}
      ordersToday={ordersToday}
      revenueCents30={revenueCents30}
      avgOrderCents={avgOrderCents}
      daily={buckets}
      statusCounts={statusCounts}
      topProducts={topProducts}
      lowStock={lowStock}
    />
  );
}
