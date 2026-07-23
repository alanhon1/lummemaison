import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import CompleteProfileForm from '@/components/account/CompleteProfileForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('completeProfile.pageTitle') };
}

// Terminal repair page for a signed-in account with no customer_profiles row.
// Deliberately does NOT bounce anywhere except forward: /account sends the
// customer here, and this page only redirects away once the row exists (or the
// session is gone). That asymmetry is what prevents the redirect loop.
export default async function CompleteProfilePage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, '/account/login'));

  // Service role, same as /account — an RLS false-negative here would send the
  // customer round the loop this page exists to break.
  const admin = createServiceClient();
  const { data: profile } = await admin
    .from('customer_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile) redirect(localePath(locale, '/account'));

  const t = await getTranslations({ locale, namespace: 'account' });
  const defaultName =
    typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '';

  return (
    <main className="min-h-[70vh] py-16 px-6 bg-cream">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl font-light text-charcoal mb-2 text-center">
          {t('completeProfile.title')}
        </h1>
        <p className="text-sm text-mist text-center mb-8">{t('completeProfile.subtitle')}</p>
        <div className="bg-white border border-bone rounded-lg p-6 md:p-8 shadow-sm">
          <CompleteProfileForm defaultName={defaultName} />
        </div>
      </div>
    </main>
  );
}
