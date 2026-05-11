'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { categories } from '@/lib/products';

const CATEGORY_EMOJIS: Record<string, string> = {
  fillers: '💉',
  mesotherapy: '✨',
  'acne-treatment': '🧴',
  'hair-treatment': '💆',
  'pharmacy-favourites': '💊',
  'topical-cosmetics': '🧪',
  'intimate-care': '🌸',
  'growth-factor-exosome': '🔬',
  curenex: '⚗️',
  dermagen: '🧬',
  gtm: '💎',
  equipment: '🔭',
  'salon-grade': '🏥',
  lipolytics: '🎯',
  botulinum: '💉',
  injections: '🩺',
  anesthetics: '💊',
  'placental-therapy': '🌿',
  'nano-needle-cannula': '🔩',
  'imported-products': '🌍',
};

export default function CategoryGrid() {
  const t = useTranslations('home.categories');
  const locale = useLocale();

  return (
    <section className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-4">
            {t('subtitle')}
          </p>
          <h2 className="section-title">{t('title')}</h2>
          <div className="gold-divider mx-auto mt-4" />
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {categories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <Link
                href={`/${locale}/catalogue/${cat.id}`}
                className="group block bg-white border border-bone p-5 hover:border-gold hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="text-2xl mb-3">{CATEGORY_EMOJIS[cat.id] || '📦'}</div>
                <h3 className="text-xs font-semibold tracking-wide text-charcoal group-hover:text-gold transition-colors leading-tight">
                  {cat.name}
                </h3>
                <p className="text-xs text-mist mt-1">
                  #{cat.range[0]}–{cat.range[1]}
                </p>
                <div className="mt-3 flex items-center gap-1 text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-semibold tracking-wider">View</span>
                  <ArrowRight size={12} />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Link
            href={`/${locale}/catalogue`}
            className="btn-secondary inline-flex items-center gap-2 text-xs"
          >
            {t('viewAll')}
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
