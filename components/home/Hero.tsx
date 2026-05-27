'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';

export default function Hero() {
  const t = useTranslations('home.hero');
  const locale = useLocale();

  return (
    <section className="relative min-h-[78vh] md:min-h-screen flex items-center overflow-hidden bg-obsidian">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-obsidian via-charcoal to-obsidian" />

      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
        <div className="w-full h-full bg-gradient-to-bl from-gold/30 to-transparent" />
      </div>

      {/* Static decorative glows (replaces 6 animated orbs) */}
      <div
        aria-hidden
        className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.10) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="absolute bottom-1/4 left-1/5 w-80 h-80 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,169,110,0.08) 0%, transparent 70%)' }}
      />

      {/* Sparkle particles */}
      <Sparkles />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,169,110,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-12 md:pt-40 md:py-32">
        <div className="max-w-3xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="h-px w-12 bg-gold" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.3em] uppercase text-gold">
              {t('tagline')}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-4xl sm:text-5xl md:text-7xl font-light leading-[1.1] text-cream mb-6"
          >
            {t('title')}
            <br />
            <span className="text-gold italic">{t('titleAccent')}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-cream/60 text-base md:text-lg leading-relaxed max-w-none md:max-w-xl mb-10"
          >
            {t('subtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <Link
              href={`/${locale}/catalogue`}
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-gold text-cream text-xs font-semibold tracking-[0.2em] uppercase hover:bg-gold-dark transition-all duration-300 group"
            >
              {t('cta')}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 border border-cream/30 text-cream text-xs font-semibold tracking-[0.2em] uppercase hover:border-gold hover:text-gold transition-all duration-300"
            >
              {t('ctaSecondary')}
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="grid grid-cols-3 gap-4 mt-10 pt-8 sm:flex sm:gap-12 sm:mt-16 sm:pt-12 border-t border-cream/10"
          >
            {[
              { value: '420', label: 'Products' }, /* keep in sync with data/products.json */
              { value: '20', label: 'Categories' },
              { value: '50+', label: 'Countries Served' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="font-display text-2xl sm:text-3xl font-light text-cream">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-cream/50 tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronDown size={20} className="text-cream/30" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function Sparkles() {
  const shouldReduceMotion = useReducedMotion();
  const particles = useMemo(() => Array.from({ length: 4 }, (_, i) => ({
    id: i,
    size: 3 + ((i * 1.5) % 5),
    top: `${15 + ((i * 23) % 70)}%`,
    left: `${10 + ((i * 31) % 80)}%`,
    delay: (i * 0.8) % 3,
    duration: 4 + ((i * 0.6) % 3),
  })), []);

  if (shouldReduceMotion) {
    return (
      <>
        {particles.map(p => (
          <div
            key={p.id}
            aria-hidden
            className="absolute rounded-full bg-gold/40 blur-sm pointer-events-none"
            style={{ width: p.size, height: p.size, top: p.top, left: p.left, opacity: 0.5 }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          aria-hidden
          className="absolute rounded-full bg-gold/40 blur-sm pointer-events-none"
          style={{ width: p.size, height: p.size, top: p.top, left: p.left }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.8, 1.2, 0.8], y: [0, -20, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
}
