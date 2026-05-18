'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';

export default function Hero() {
  const t = useTranslations('home.hero');
  const locale = useLocale();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-obsidian">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-obsidian via-charcoal to-obsidian" />

      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
        <div className="w-full h-full bg-gradient-to-bl from-gold/30 to-transparent" />
      </div>

      {/* Animated floating orbs — right side */}
      <motion.div
        className="absolute top-1/4 right-1/4 w-64 h-64 bg-gold/8 rounded-full blur-3xl pointer-events-none"
        animate={{ y: [0, -30, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/3 right-1/6 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 right-1/3 w-32 h-32 bg-gold/12 rounded-full blur-2xl pointer-events-none"
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Animated floating orbs — left side (subtler) */}
      <motion.div
        className="absolute top-1/3 left-1/6 w-56 h-56 bg-gold/6 rounded-full blur-3xl pointer-events-none"
        animate={{ y: [0, 25, 0], x: [0, 10, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-1/4 left-1/5 w-72 h-72 bg-gold/4 rounded-full blur-3xl pointer-events-none"
        animate={{ y: [0, -18, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-2/3 left-1/3 w-28 h-28 bg-gold/10 rounded-full blur-2xl pointer-events-none"
        animate={{ y: [0, 12, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
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

      <div className="relative max-w-7xl mx-auto px-6 py-32 pt-40">
        <div className="max-w-3xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="h-px w-12 bg-gold" />
            <span className="text-xs font-semibold tracking-[0.3em] uppercase text-gold">
              SH Core Stetics Global
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl md:text-7xl font-light leading-[1.1] text-cream mb-6"
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
            className="text-cream/60 text-base md:text-lg leading-relaxed max-w-xl mb-10"
          >
            {t('subtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              href={`/${locale}/catalogue`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gold text-cream text-xs font-semibold tracking-[0.2em] uppercase hover:bg-gold-dark transition-all duration-300 group"
            >
              {t('cta')}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-3 px-8 py-4 border border-cream/30 text-cream text-xs font-semibold tracking-[0.2em] uppercase hover:border-gold hover:text-gold transition-all duration-300"
            >
              {t('ctaSecondary')}
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex gap-12 mt-16 pt-12 border-t border-cream/10"
          >
            {[
              { value: '438', label: 'Products' },
              { value: '20', label: 'Categories' },
              { value: '50+', label: 'Countries Served' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="font-display text-3xl font-light text-cream">{stat.value}</div>
                <div className="text-xs text-cream/50 tracking-wider mt-1">{stat.label}</div>
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
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
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
  // Spread across the full viewport (5% – 95%) so left and right both get particles.
  const particles = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i,
    size: 3 + ((i * 0.9) % 7),
    top: `${10 + ((i * 13.7) % 80)}%`,
    left: `${5 + ((i * 19.3) % 90)}%`,
    delay: (i * 0.6) % 3.5,
    duration: 3 + ((i * 0.4) % 3),
  })), []);

  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
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
