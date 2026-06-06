import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import CheckoutSteps from '@/components/checkout/CheckoutSteps';
import PaymentStep, { type PaymentInfo } from '@/components/checkout/PaymentStep';
import { siteConfig } from '@/lib/site-config';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('payment.title') };
}

// Read an env var, treat empty / placeholder text as "not configured" so the
// UI hides the row instead of showing misleading information.
function envValue(key: string): string {
  const raw = process.env[key];
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Old `.env.example` shipped with bracketed placeholders like
  // "[Account name pending]" — treat these as empty so the page never renders
  // pending text that a customer might mistake for real account info.
  if (/^\[.*\]$/.test(trimmed)) return '';
  return trimmed;
}

export default async function CheckoutPaymentPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const returnTo = localePath(locale, '/checkout/payment');
    redirect(`${localePath(locale, '/account/login')}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const t = await getTranslations({ locale, namespace: 'checkout' });

  const usdtNetworks: PaymentInfo['usdt']['networks'] = [];
  const erc20 = envValue('USDT_ERC20_ADDRESS');
  if (erc20) usdtNetworks.push({ id: 'erc20', label: 'ERC20 (Ethereum)', address: erc20 });
  const trc20 = envValue('USDT_TRC20_ADDRESS');
  if (trc20) usdtNetworks.push({ id: 'trc20', label: 'TRC20 (Tron)', address: trc20 });

  const paymentInfo: PaymentInfo = {
    wise: {
      accountName: envValue('WISE_ACCOUNT_NAME'),
      bankName: envValue('WISE_BANK_NAME'),
      accountNumber: envValue('WISE_ACCOUNT_NUMBER'),
      swift: envValue('WISE_SWIFT'),
      address: envValue('WISE_ADDRESS'),
      city: envValue('WISE_CITY'),
      country: envValue('WISE_COUNTRY'),
      postcode: envValue('WISE_POSTCODE'),
      currency: envValue('WISE_CURRENCY'),
    },
    usdt: {
      networks: usdtNetworks,
      // Hidden while WhatsApp is disabled — USDT questions route to email.
      whatsapp: siteConfig.contactChannels.whatsapp ? envValue('PAYMENT_WHATSAPP') : '',
    },
    adminEmail: envValue('ADMIN_NOTIFICATION_EMAIL'),
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
