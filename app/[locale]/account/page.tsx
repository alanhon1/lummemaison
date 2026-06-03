import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/account/DashboardClient';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('dashboard.pageTitle') };
}

export default async function AccountPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/account/login`);

  const t = await getTranslations({ locale, namespace: 'account' });

  const [{ data: profile }, { data: orders }] = await Promise.all([
    supabase.from('customer_profiles').select('*').eq('user_id', user.id).single(),
    supabase
      .from('orders')
      .select('id, order_number, order_seq, status, total_cents, currency, created_at, last_message_seen_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (!profile) {
    // Edge case: auth user exists but profile row missing (e.g. signup interrupted).
    // Send them back through signup to repair.
    redirect(`/${locale}/account/signup`);
  }

  // Per-order unread message counts. RLS on order_messages already filters
  // to (is_internal = false AND auth.uid() = orders.user_id), so the
  // user-session client returns only the customer's own visible messages.
  // One query, then count in JS — cheap for ≤50 orders × handful of messages.
  const orderRows = orders ?? [];
  const orderIds = orderRows.map(o => o.id);
  let unreadByOrder: Record<number, number> = {};
  if (orderIds.length > 0) {
    const { data: msgs } = await supabase
      .from('order_messages')
      .select('order_id, created_at')
      .in('order_id', orderIds);
    const seenByOrder: Record<number, string | null> = {};
    for (const o of orderRows) seenByOrder[o.id] = o.last_message_seen_at;
    for (const m of msgs ?? []) {
      const seen = seenByOrder[m.order_id];
      if (!seen || new Date(m.created_at) > new Date(seen)) {
        unreadByOrder[m.order_id] = (unreadByOrder[m.order_id] ?? 0) + 1;
      }
    }
  }

  return (
    <main className="py-16 px-6 bg-cream min-h-[70vh]">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl font-light text-charcoal mb-2">
          {t('dashboard.title')}
        </h1>
        <p className="text-sm text-mist mb-10">{t('dashboard.subtitle', { name: profile.full_name })}</p>
        <DashboardClient
          email={user.email ?? ''}
          profile={profile}
          orders={orderRows.map(o => ({
            id: o.id,
            order_number: o.order_number,
            order_seq: o.order_seq,
            status: o.status,
            total_cents: o.total_cents,
            currency: o.currency,
            created_at: o.created_at,
            unread_message_count: unreadByOrder[o.id] ?? 0,
          }))}
        />
      </div>
    </main>
  );
}
