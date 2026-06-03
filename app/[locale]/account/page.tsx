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
      .select('id, order_number, order_seq, status, total_cents, currency, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (!profile) {
    // Edge case: auth user exists but profile row missing (e.g. signup interrupted).
    // Send them back through signup to repair.
    redirect(`/${locale}/account/signup`);
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
          orders={orders ?? []}
        />
      </div>
    </main>
  );
}
