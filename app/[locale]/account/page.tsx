import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import { ensureCustomerCode } from '@/lib/customer-code';
import DashboardClient from '@/components/account/DashboardClient';

export const dynamic = 'force-dynamic';

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
  if (!user) redirect(localePath(locale, '/account/login'));

  const t = await getTranslations({ locale, namespace: 'account' });

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    // Edge case: auth user exists but profile row missing (e.g. signup interrupted).
    // Send them back through signup to repair.
    redirect(localePath(locale, '/account/signup'));
  }

  // First confirmed login: assign the admin-facing Customer ID if not yet set.
  // Reaching this page implies a confirmed session (unconfirmed users can't log
  // in). Fire-and-forget — a failure just defers the code to the next visit.
  if (!profile.customer_code) {
    void ensureCustomerCode(user.id);
  }

  // Order list. We try to include `last_message_seen_at` (powers the unread
  // badge), but fall back gracefully if that column hasn't been added to this
  // database yet (migration 006). Without this guard a missing column makes the
  // whole query error and the customer sees an empty order history.
  const ORDER_COLS = 'id, order_number, order_seq, status, total_cents, currency, created_at';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderRows: any[] = [];
  let hasSeenColumn = true;
  const withSeen = await supabase
    .from('orders')
    .select(`${ORDER_COLS}, last_message_seen_at`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (withSeen.error) {
    hasSeenColumn = false;
    const fallback = await supabase
      .from('orders')
      .select(ORDER_COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    orderRows = fallback.data ?? [];
  } else {
    orderRows = withSeen.data ?? [];
  }

  // Per-order unread message counts (only when the seen-tracking column exists).
  const unreadByOrder: Record<number, number> = {};
  if (hasSeenColumn && orderRows.length > 0) {
    const orderIds = orderRows.map(o => o.id as number);
    const { data: msgs } = await supabase
      .from('order_messages')
      .select('order_id, created_at')
      .in('order_id', orderIds);
    const seenByOrder: Record<number, string | null> = {};
    for (const o of orderRows) seenByOrder[o.id as number] = (o.last_message_seen_at as string | null) ?? null;
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
