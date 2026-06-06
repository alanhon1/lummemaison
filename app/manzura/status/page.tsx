import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
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
import KanbanBoard, { type KanbanOrder } from '@/components/admin/KanbanBoard';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 2;

const STATUS_LABELS: Array<{ status: string; label: string }> = [
  { status: 'order_received', label: 'Received' },
  { status: 'payment_verified', label: 'Payment verified' },
  { status: 'packaging', label: 'Packing' },
  { status: 'shipped', label: 'Shipped' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'cancelled', label: 'Cancelled' },
];

interface PageProps {
  searchParams: Promise<{ view?: string }>;
}

export default async function StatusPage({ searchParams }: PageProps) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const { view: rawView } = await searchParams;
  const view = rawView === 'stats' ? 'stats' : 'board';

  const supabase = createServiceClient();

  const tabBar = (
    <div className="flex gap-2 mb-6">
      {(['board', 'stats'] as const).map(v => (
        <Link
          key={v}
          href={`/manzura/status${v === 'board' ? '' : '?view=stats'}`}
          className={`text-xs uppercase tracking-widest px-4 py-2 rounded-full border transition-colors ${
            view === v
              ? 'bg-charcoal text-cream border-charcoal'
              : 'text-mist border-bone hover:text-charcoal hover:border-charcoal'
          }`}
        >
          {v === 'board' ? 'Board' : 'Analytics'}
        </Link>
      ))}
    </div>
  );

  // ── BOARD VIEW ──────────────────────────────────────────────
  if (view === 'board') {
    const { data: rawOrders } = await supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, total_cents, currency, created_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(500);

    const orders = (rawOrders ?? []) as KanbanOrder[];
    const ordersByStatus = new Map<string, KanbanOrder[]>();
    for (const o of orders) {
      const arr = ordersByStatus.get(o.status) ?? [];
      arr.push(o);
      ordersByStatus.set(o.status, arr);
    }

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl font-light text-charcoal mb-6">Status</h1>
        {tabBar}
        <KanbanBoard ordersByStatus={ordersByStatus} />
      </div>
    );
  }

  // ── STATS VIEW ───────────────────────────────────────────────
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

  const statusCounts: StatusCount[] = STATUS_LABELS.map(({ status, label }) => ({
    status,
    label,
    count: allStatus.filter(o => o.status === status).length,
  }));
  const totalOrders = allStatus.length;

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
    if (b) { b.count += 1; b.revenueCents += o.total_cents ?? 0; }
    revenueCents30 += o.total_cents ?? 0;
    if (key === startTodayKey) ordersToday += 1;
  }
  const avgOrderCents = windowOrders.length > 0 ? Math.round(revenueCents30 / windowOrders.length) : 0;

  const qtyByName = new Map<string, number>();
  for (const it of items) {
    const name = it.product_name ?? 'Unknown';
    qtyByName.set(name, (qtyByName.get(name) ?? 0) + (it.quantity ?? 0));
  }
  const topProducts: TopProduct[] = [...qtyByName.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const allProducts = await getAllProducts();
  const nameById = new Map(allProducts.map(p => [p.id, p.name]));
  const lowStock: LowStockItem[] = lowStockRows.map(r => ({
    id: r.product_id,
    name: nameById.get(r.product_id) ?? `Product ${r.product_id}`,
    stock: r.stock,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-display text-3xl font-light text-charcoal mb-6">Status</h1>
      {tabBar}
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
    </div>
  );
}
