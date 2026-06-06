import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import DisclaimerStep from '@/components/checkout/DisclaimerStep';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('disclaimers.title') };
}

export default async function CheckoutDisclaimersPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const returnTo = localePath(locale, '/checkout/disclaimers');
    redirect(`${localePath(locale, '/account/login')}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const t = await getTranslations({ locale, namespace: 'checkout' });

  return (
    <main className="bg-cream min-h-[70vh] py-12 md:py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl text-charcoal mb-2">{t('disclaimers.title')}</h1>
        <p className="text-sm text-mist mb-8">{t('disclaimers.subtitle')}</p>
        <CheckoutSteps current="disclaimers" />
        <DisclaimerStep />
      </div>
    </main>
  );
}
