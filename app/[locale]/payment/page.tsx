import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import PaymentClient from '@/components/checkout/PaymentClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'payment' });
  return { title: t('title') };
}

export default async function PaymentPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  return (
    <div className="pt-24 min-h-screen bg-cream">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <PaymentClient />
      </div>
    </div>
  );
}
