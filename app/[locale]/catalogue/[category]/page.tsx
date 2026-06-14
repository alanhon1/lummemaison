import { Suspense } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCategoryById } from '@/lib/products';
import { getAllProducts } from '@/lib/catalogue';
import CatalogueClient from '@/components/catalogue/CatalogueClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }): Promise<Metadata> {
  const { locale, category } = await params;
  const cat = getCategoryById(category);
  if (!cat) return { title: 'Category Not Found' };
  const t = await getTranslations({ locale, namespace: 'catalogue.categoryNames' });
  const name = t(category);
  return {
    title: name,
    description: `Browse our ${name} product range`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { locale, category } = await params;
  const cat = getCategoryById(category);
  if (!cat) notFound();
  const t = await getTranslations({ locale, namespace: 'catalogue.categoryNames' });
  const products = await getAllProducts();

  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-0">
        <div className="px-6 py-12 border-b border-bone">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-3">
            Category
          </p>
          <h1 className="section-title">{t(category)}</h1>
          <div className="gold-divider mt-3" />
        </div>
        <Suspense fallback={<div className="p-12 text-center text-mist">Loading...</div>}>
          <CatalogueClient products={products} initialCategory={category} />
        </Suspense>
      </div>
    </div>
  );
}
