import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import ReferralsClient, { type ReferralCode, type ReferralOrder } from '@/components/admin/ReferralsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Referrals' };

export default async function ReferralsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();
  const [{ data: codes }, { data: ordersRaw }] = await Promise.all([
    supabase
      .from('referral_codes')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_seq, order_number, status, customer_name, total_cents, currency, created_at, referral_code')
      .not('referral_code', 'is', null)
      .not('order_number', 'ilike', 'TEST-%')
      .order('created_at', { ascending: false })
      .limit(5000),
  ]);

  const orders: ReferralOrder[] = ((ordersRaw ?? []) as Array<{
    id: number; order_seq: number | null; order_number: string; status: string;
    customer_name: string; total_cents: number; currency: string; created_at: string;
    referral_code: string;
  }>).map(o => ({
    id: o.id,
    display: o.order_seq != null ? formatOrderNumber(o.order_seq) : o.order_number,
    status: o.status,
    customer_name: o.customer_name,
    total_cents: o.total_cents,
    currency: o.currency,
    created_at: o.created_at,
    referral_code: o.referral_code.toLowerCase(),
  }));

  return <ReferralsClient codes={(codes ?? []) as ReferralCode[]} orders={orders} />;
}
