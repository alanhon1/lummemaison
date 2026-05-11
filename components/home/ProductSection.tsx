'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import ProductCard from '@/components/catalogue/ProductCard';
import type { Product } from '@/lib/products';

interface ProductSectionProps {
  titleKey: string;
  subtitleKey: string;
  products: Product[];
  sectionId?: string;
  bgClass?: string;
}

export default function ProductSection({
  titleKey,
  subtitleKey,
  products,
  bgClass = 'bg-white',
}: ProductSectionProps) {
  const t = useTranslations(titleKey as any);
  const locale = useLocale();

  if (products.length === 0) return null;

  return (
    <section className={`py-24 ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-3">
              {subtitleKey}
            </p>
            <h2 className="section-title">{titleKey.split('.').pop()}</h2>
            <div className="gold-divider mt-3" />
          </div>
          <Link
            href={`/${locale}/catalogue`}
            className="hidden md:flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-charcoal hover:text-gold transition-colors"
          >
            View All
            <ArrowRight size={14} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.slice(0, 8).map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10 md:hidden">
          <Link
            href={`/${locale}/catalogue`}
            className="btn-secondary inline-flex items-center gap-2 text-xs"
          >
            View All
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
