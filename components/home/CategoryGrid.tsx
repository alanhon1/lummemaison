'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Droplets, Sparkles, FlaskConical, Scissors, Pill, Layers, Heart, Dna, Zap, Shield, Gem, Microscope, Brush, Target, Syringe, Activity, Leaf, PenLine, Globe, Package, type LucideIcon } from 'lucide-react';
import { categories } from '@/lib/products';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  fillers: Droplets,
  mesotherapy: Sparkles,
  'acne-treatment': FlaskConical,
  'hair-treatment': Scissors,
  'pharmacy-favourites': Pill,
  'topical-cosmetics': Layers,
  'intimate-care': Heart,
  'growth-factor-exosome': Dna,
  curenex: Zap,
  dermagen: Shield,
  gtm: Gem,
  equipment: Microscope,
  'salon-grade': Brush,
  lipolytics: Target,
  botulinum: Syringe,
  injections: Activity,
  anesthetics: Pill,
  'placental-therapy': Leaf,
  'nano-needle-cannula': PenLine,
  'imported-products': Globe,
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
          {categories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Package;
            return (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <Link
                  href={`/${locale}/catalogue/${cat.id}`}
                  className="group block bg-cream border border-gold/20 p-5 hover:border-gold hover:shadow-md transition-all duration-300 hover:-translate-y-1 rounded-sm"
                >
                  <div className="mb-3">
                    <Icon
                      size={22}
                      strokeWidth={1.5}
                      className="text-gold group-hover:text-gold-dark transition-colors duration-300"
                    />
                  </div>
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
            );
          })}
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
