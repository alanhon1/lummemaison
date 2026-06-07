import { Suspense } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import CatalogueClient from '@/components/catalogue/CatalogueClient';
import PageHeaderBand from '@/components/layout/PageHeaderBand';
import { getAllProducts } from '@/lib/catalogue';
import { categories } from '@/lib/products';

export const dynamic = 'force-dynamic';

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
  const products = await getAllProducts();
  return (
    <div className="pt-20 min-h-screen catalogue-luxe-bg">
      <PageHeaderBand title="Product Catalogue" subtitle={`${products.length} products across ${categories.length} categories`} />
      <div className="max-w-7xl mx-auto px-0">
        <Suspense fallback={<div className="p-12 text-center text-mist">Loading catalogue...</div>}>
          <CatalogueClient products={products} />
        </Suspense>
      </div>
    </div>
  );
}
