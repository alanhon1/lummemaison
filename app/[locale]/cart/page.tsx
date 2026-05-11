import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CartPageClient from '@/components/checkout/CartPageClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cart' });
  return { title: t('title') };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  return (
    <div className="pt-24 min-h-screen bg-cream">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="section-title mb-2">Your Cart</h1>
        <div className="gold-divider mb-8" />
        <CartPageClient />
      </div>
    </div>
  );
}
