'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Shield, Plane, Globe, Briefcase } from 'lucide-react';

const icons = [Shield, Plane, Globe, Briefcase];
const keys = ['authentic', 'shipping', 'global', 'b2b'] as const;

export default function WhyChooseUs() {
  const t = useTranslations('home.whyChooseUs');

  return (
    <section className="py-24 bg-obsidian text-cream overflow-hidden">
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
          <h2 className="font-display text-4xl md:text-5xl font-light text-cream">
            {t('title')}
          </h2>
          <div className="gold-divider mx-auto mt-4" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {keys.map((key, i) => {
            const Icon = icons[i];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group text-center p-8 border border-cream/10 hover:border-gold/40 transition-all duration-500 hover:bg-cream/5"
              >
                <div className="w-12 h-12 border border-gold/40 flex items-center justify-center mx-auto mb-5 group-hover:border-gold group-hover:bg-gold/10 transition-all duration-300">
                  <Icon size={20} className="text-gold" />
                </div>
                <h3 className="font-display text-xl font-light text-cream mb-3">
                  {t(`${key}.title` as any)}
                </h3>
                <p className="text-xs text-cream/50 leading-relaxed">
                  {t(`${key}.desc` as any)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
