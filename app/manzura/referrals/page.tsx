import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import ReferralsClient, { type ReferralCode, type ReferralOrder, type ReferralSignup } from '@/components/admin/ReferralsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Referrals' };

export default async function ReferralsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();
  const [{ data: codes }, { data: ordersRaw }, { data: signupsRaw }, authResult] = await Promise.all([
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
    supabase
      .from('customer_profiles')
      .select('user_id, full_name, created_at, referral_code')
      .not('referral_code', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000),
    // Emails live in auth.users, not customer_profiles — same lookup the admin
    // users page does.
    supabase.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map(
    (authResult.data?.users ?? []).map(u => [u.id, u.email ?? '']),
  );

  const signups: ReferralSignup[] = ((signupsRaw ?? []) as Array<{
    user_id: string; full_name: string; created_at: string; referral_code: string;
  }>).map(s => ({
    user_id: s.user_id,
    full_name: s.full_name,
    email: emailById.get(s.user_id) ?? '',
    created_at: s.created_at,
    referral_code: s.referral_code.toLowerCase(),
  }));

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

  return <ReferralsClient codes={(codes ?? []) as ReferralCode[]} orders={orders} signups={signups} />;
}
