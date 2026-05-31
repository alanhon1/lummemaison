import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import PaymentStep from '@/components/checkout/PaymentStep';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('payment.title') };
}

export default async function CheckoutPaymentPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const returnTo = `/${locale}/checkout/payment`;
    redirect(`/${locale}/account/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const t = await getTranslations({ locale, namespace: 'checkout' });

  const paymentInfo = {
    wise: {
      accountName: process.env.WISE_ACCOUNT_NAME || '[Account name pending]',
      bankName: process.env.WISE_BANK_NAME || '[Bank name pending]',
      accountNumber: process.env.WISE_ACCOUNT_NUMBER || '[Account number pending]',
      swift: process.env.WISE_SWIFT || '[SWIFT/Routing pending]',
    },
    usdt: {
      address: process.env.USDT_WALLET_ADDRESS || '[Wallet address pending]',
      network: 'TRC-20 (Tron)',
    },
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || '[admin email pending]',
  };

  return (
    <main className="bg-cream min-h-[70vh] py-12 md:py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl text-charcoal mb-2">{t('payment.title')}</h1>
        <p className="text-sm text-mist mb-8">{t('payment.subtitle')}</p>
        <CheckoutSteps current="payment" />
        <PaymentStep payment={paymentInfo} serverError={error} />
      </div>
    </main>
  );
}
