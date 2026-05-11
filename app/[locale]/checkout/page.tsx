import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CheckoutClient from '@/components/checkout/CheckoutClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'checkout' });
  return { title: t('title') };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  return (
    <div className="pt-24 min-h-screen bg-cream">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="section-title mb-2">Checkout</h1>
        <div className="gold-divider mb-8" />
        <CheckoutClient />
      </div>
    </div>
  );
}
