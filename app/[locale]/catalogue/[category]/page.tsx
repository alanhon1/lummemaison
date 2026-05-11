import { Suspense } from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryById } from '@/lib/products';
import CatalogueClient from '@/components/catalogue/CatalogueClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategoryById(category);
  if (!cat) return { title: 'Category Not Found' };
  return {
    title: cat.name,
    description: `Browse our ${cat.name} product range`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ locale: string; category: string }> }) {
  const { category } = await params;
  const cat = getCategoryById(category);
  if (!cat) notFound();

  return (
    <div className="pt-20 min-h-screen">
      <div className="max-w-7xl mx-auto px-0">
        <div className="px-6 py-12 border-b border-bone">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-3">
            Category
          </p>
          <h1 className="section-title">{cat.name}</h1>
          <div className="gold-divider mt-3" />
        </div>
        <Suspense fallback={<div className="p-12 text-center text-mist">Loading...</div>}>
          <CatalogueClient initialCategory={category} />
        </Suspense>
      </div>
    </div>
  );
}
