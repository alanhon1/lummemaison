import { Suspense } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CatalogueClient from '@/components/catalogue/CatalogueClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'catalogue' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function CataloguePage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-0">
        {/* Header */}
        <div className="px-6 py-12 border-b border-bone">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-3">
            SH Core Stetics Global
          </p>
          <h1 className="section-title">Product Catalogue</h1>
          <div className="gold-divider mt-3" />
          {/* keep in sync with data/products.json */}
          <p className="text-sm text-mist mt-3">421 products across 20 categories</p>
        </div>

        <Suspense fallback={<div className="p-12 text-center text-mist">Loading catalogue...</div>}>
          <CatalogueClient />
        </Suspense>
      </div>
    </div>
  );
}
