import { Suspense } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CatalogueClient from '@/components/catalogue/CatalogueClient';
import PageHeaderBand from '@/components/layout/PageHeaderBand';

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
      <PageHeaderBand title="Product Catalogue" subtitle="420 products across 20 categories" />
      <div className="max-w-7xl mx-auto px-0">
        <Suspense fallback={<div className="p-12 text-center text-mist">Loading catalogue...</div>}>
          <CatalogueClient />
        </Suspense>
      </div>
    </div>
  );
}
