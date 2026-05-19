import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Hero from '@/components/home/Hero';
import CategoryGrid from '@/components/home/CategoryGrid';
import WhyChooseUs from '@/components/home/WhyChooseUs';
import CTASection from '@/components/home/CTASection';
import ProductCard from '@/components/catalogue/ProductCard';
import { getBestSellers, getNewProducts } from '@/lib/products';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home.hero' });
  return {
    title: `${t('title')} ${t('titleAccent')} | Lumée Maison`,
    description: t('subtitle'),
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  const bestSellers = getBestSellers(8);
  const newProducts = getNewProducts(8);

  return (
    <div className="luxe-bg">
      <Hero />
      <CategoryGrid />

      {/* Best Sellers */}
      {bestSellers.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-3">
                Trusted by Professionals
              </p>
              <h2 className="section-title">Best Sellers</h2>
              <div className="gold-divider mt-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {bestSellers.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <WhyChooseUs />

      {/* New Arrivals */}
      {newProducts.length > 0 && (
        <section className="py-24 bg-cream">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-12">
              <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-3">
                Latest Additions
              </p>
              <h2 className="section-title">New Arrivals</h2>
              <div className="gold-divider mt-3" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {newProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CTASection />
    </div>
  );
}
