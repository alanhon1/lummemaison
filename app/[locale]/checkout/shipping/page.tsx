import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import ShippingForm, { type ProfileSeed } from '@/components/checkout/ShippingForm';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('shipping.title') };
}

export default async function CheckoutShippingPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const returnTo = `/${locale}/checkout/shipping`;
    redirect(`/${locale}/account/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    // Customer signed up but profile row missing — finish signup first.
    redirect(`/${locale}/account/signup`);
  }

  const seed: ProfileSeed = {
    fullName: profile.full_name,
    email: user.email ?? '',
    phone: profile.phone,
    country: profile.country,
    street: profile.street,
    city: profile.city,
    stateProvince: profile.state_province ?? '',
    postalCode: profile.postal_code,
    fedexAccount: profile.fedex_account ?? '',
  };

  const t = await getTranslations({ locale, namespace: 'checkout' });

  return (
    <main className="bg-cream min-h-[70vh] py-12 md:py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl text-charcoal mb-2">{t('shipping.title')}</h1>
        <p className="text-sm text-mist mb-8">{t('shipping.subtitle')}</p>
        <CheckoutSteps current="shipping" />
        <ShippingForm profile={seed} />
      </div>
    </main>
  );
}
