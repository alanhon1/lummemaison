import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import DashboardClient from '@/components/admin/DashboardClient';
import { categories } from '@/lib/products';
import { getAllProducts } from '@/lib/catalogue';
import { listBackups } from '@/lib/backup';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 2;

export default async function DashboardPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();
  const products = await getAllProducts();

  // Today (in the server's timezone — Vercel runs UTC, which is what the
  // mom-admin will read against the orders that were created in UTC too).
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    { count: ordersTodayCount },
    { count: orderReceivedCount },
    { count: awaitingShipCount },
    { data: lowStockRows },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('order_number', 'ilike', 'TEST-%')
      .gte('created_at', startOfToday.toISOString()),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('order_number', 'ilike', 'TEST-%')
      .eq('status', 'order_received'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .not('order_number', 'ilike', 'TEST-%')
      .in('status', ['payment_verified', 'packaging']),
    supabase
      .from('product_stock')
      .select('product_id, stock')
      .lte('stock', LOW_STOCK_THRESHOLD),
    supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, total_cents, currency, created_at')
      .not('order_number', 'ilike', 'TEST-%')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  // Catalogue backups now live in Supabase Storage (persist on Vercel). The
  // panel is de-emphasised below the operational stats.
  const backups = await listBackups();

  return (
    <DashboardClient
      newOrdersToday={ordersTodayCount ?? 0}
      awaitingVerification={orderReceivedCount ?? 0}
      awaitingShipment={awaitingShipCount ?? 0}
      lowStockCount={(lowStockRows ?? []).length}
      totalProducts={products.length}
      totalCategories={categories.length}
      recentOrders={(recentOrders ?? []).map(o => ({
        id: o.id,
        display: o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number,
        status: o.status,
        customer: o.customer_name,
        total_cents: o.total_cents,
        currency: o.currency,
        created_at: o.created_at,
      }))}
      backups={backups}
    />
  );
}
