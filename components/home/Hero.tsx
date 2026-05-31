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

  function handleExplore() {
    document.getElementById('our-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section className="relative min-h-[82vh] md:min-h-[88vh] flex items-center overflow-hidden">
      {/* House of Light backdrop — luminous cream + warm sun.
          Designer note: swap this gradient block for a real editorial photo when ready
          (recommend exporting as /public/images/hero/maison.webp and using next/image fill). */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, #faf8f5 0%, #f5ede0 35%, #efd9b8 70%, #e6c598 100%)',
        }}
      />

      {/* Sun glow — warm halo from upper-right */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-[36rem] h-[36rem] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255,236,200,0.9) 0%, rgba(221,192,142,0.55) 30%, rgba(201,169,110,0.18) 55%, transparent 75%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Soft botanical glow — lower-left */}
      <div
        aria-hidden
        className="absolute -bottom-24 -left-16 w-[28rem] h-[28rem] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(250,242,225,0.8) 0%, rgba(232,226,217,0.4) 40%, transparent 70%)',
        }}
      />

      {/* Cream readability overlay over the text column (left side) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, rgba(250,248,245,0.78) 0%, rgba(250,248,245,0.35) 45%, transparent 70%)',
        }}
      />

      {/* Sparkle particles */}
      <Sparkles />

      {/* Grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(201,169,110,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-48 md:pt-32 md:pb-32">
        <div className="max-w-3xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-5"
          >
            <div className="h-px w-12 bg-gold" />
            <span className="text-[10px] sm:text-xs font-semibold tracking-[0.3em] uppercase text-gold-dark">
              {t('tagline')}
            </span>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-[2rem] sm:text-5xl md:text-7xl font-light leading-[1.1] text-charcoal mb-4"
          >
            {t('title')}
            <br />
            <span className="text-gold-dark italic">{t('titleAccent')}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-mist text-base md:text-lg leading-relaxed max-w-none md:max-w-xl mb-7"
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
              className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 border border-charcoal/30 text-charcoal text-xs font-semibold tracking-[0.2em] uppercase hover:border-gold-dark hover:text-gold-dark hover:bg-cream/40 transition-all duration-300"
            >
              {t('ctaSecondary')}
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="grid grid-cols-3 gap-4 mt-8 pt-6 sm:flex sm:gap-12 sm:mt-12 sm:pt-8 border-t border-charcoal/10"
          >
            {[
              { value: '420', label: 'Products' }, /* keep in sync with data/products.json */
              { value: '20', label: 'Categories' },
              { value: '50+', label: 'Countries Served' },
            ].map(stat => (
              <div key={stat.label}>
                <div className="font-display text-2xl sm:text-3xl font-light text-charcoal">{stat.value}</div>
                <div className="text-[10px] sm:text-xs text-mist tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator — sits above mobile browser bottom UI */}
      <motion.button
        type="button"
        onClick={handleExplore}
        aria-label={t('exploreAria')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-[120px] md:bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gold-dark hover:text-gold transition-colors duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-gold-dark rounded-md px-3 py-2"
        style={{ filter: 'drop-shadow(0 2px 6px rgba(168,135,74,0.5))' }}
      >
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase">
          {t('explore')}
        </span>
        <motion.span
          aria-hidden
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="leading-none"
        >
          <ChevronDown size={30} strokeWidth={2.5} />
        </motion.span>
      </motion.button>
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
