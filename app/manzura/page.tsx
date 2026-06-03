import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import fs from 'fs';
import path from 'path';
import { sessionOptions, type SessionData } from '@/lib/session';
import DashboardClient from '@/components/admin/DashboardClient';
import { products, categories } from '@/lib/products';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 2;

export default async function DashboardPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();

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
      .gte('created_at', startOfToday.toISOString()),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'order_received'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['payment_verified', 'packaging']),
    supabase
      .from('product_stock')
      .select('product_id, stock')
      .lte('stock', LOW_STOCK_THRESHOLD),
    supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, total_cents, currency, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  // Backups stay visible so the long-standing data-restore flow keeps working,
  // but they're now de-emphasised below the operational stats.
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  let backups: { name: string; size: number; created: string }[] = [];
  if (fs.existsSync(backupDir)) {
    backups = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, created: stat.mtime.toLocaleString() };
      })
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 5);
  }

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
