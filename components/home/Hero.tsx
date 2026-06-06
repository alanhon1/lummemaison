'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { localePath } from '@/lib/i18n';

export default function Hero() {
  const t = useTranslations('home.hero');
  const locale = useLocale();

  function handleExplore() {
    const el = document.getElementById('our-categories');
    if (!el) return;
    const targetY = el.getBoundingClientRect().top + window.scrollY;
    // Always animate (even with OS reduce-motion) — the owner wants the smooth
    // descent. We drive each frame with behavior:'auto' so the global
    // `scroll-behavior: smooth` CSS doesn't also try to animate every scrollTo
    // call — that double-animation is what made it jump/teleport.
    const startY = window.scrollY;
    const diff = targetY - startY;
    const duration = 900;
    let start: number | undefined;
    const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const step = (ts: number) => {
      if (start === undefined) start = ts;
      const elapsed = ts - start;
      const t = Math.min(1, elapsed / duration);
      window.scrollTo({ top: startY + diff * easeInOutQuad(t), behavior: 'auto' });
      if (elapsed < duration) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  return (
    <section className="relative min-h-[82vh] md:min-h-[88vh] flex items-center overflow-hidden">
      {/* CSS gradient fallback — visible if the photo fails or is missing */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, #faf8f5 0%, #f5ede0 35%, #efd9b8 70%, #e6c598 100%)',
        }}
      />

      {/* Hero photo — classical maison + garden + fountain. Sits on top of the
          gradient fallback so a missing file gracefully reveals the cream/sun backdrop. */}
      <Image
        src="/hero-maison.jpg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover pointer-events-none select-none"
        style={{ objectPosition: 'center center' }}
      />

      {/* Cream readability overlay — light touch so the maison stays 70–80% sharp.
          Text legibility comes from the per-element text-shadow glow below. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,248,235,0.28) 0%, rgba(255,248,235,0.40) 55%, rgba(255,248,235,0.50) 100%)',
        }}
      />

      {/* Sparkle particles — golden dust motes catching sunlight */}
      <Sparkles />

      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-48 md:pt-32 md:pb-32">
        <div className="max-w-3xl">
          {/* Tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 mb-5"
          >
            <div className="h-[2px] w-16 rounded-full animated-divider" />
            <span
              className="text-[10px] sm:text-xs font-bold tracking-[0.3em] uppercase text-gold-dark"
              style={{
                textShadow: '0 1px 3px rgba(0,0,0,0.25)',
              }}
            >
              {t('tagline')}
            </span>
          </motion.div>

          {/* Title — lit from behind by a soft cream halo so it pops on the maison */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-[2rem] sm:text-5xl md:text-7xl font-semibold leading-[1.1] text-obsidian mb-4"
            style={{
              textShadow: '0 1px 2px rgba(0,0,0,0.20), 0 2px 8px rgba(255,248,235,0.5)',
            }}
          >
            <span className="logo-shimmer">
              {t('title')}
            </span>
            <br />
            <span className="text-gold-dark italic">{t('titleAccent')}</span>
          </motion.h1>

          {/* Subtitle — italic Cormorant Garamond with a subtler glow */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-display italic font-semibold text-lg md:text-xl leading-relaxed max-w-none md:max-w-xl mb-7 text-charcoal"
            style={{
              textShadow: '0 1px 3px rgba(0,0,0,0.22)',
            }}
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
              href={localePath(locale, '/catalogue')}
              className="btn-gold btn-loop w-full sm:w-auto gap-3 group"
            >
              {t('cta')}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href={localePath(locale, '/contact')}
              className="btn-secondary w-full sm:w-auto"
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
        className="absolute bottom-[120px] md:bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 rounded-full border border-charcoal/70 bg-cream/70 backdrop-blur-sm px-3.5 py-1.5 text-charcoal hover:text-gold-dark hover:border-gold-dark shadow-[0_3px_12px_rgba(0,0,0,0.16)] hover:shadow-[0_0_18px_rgba(201,169,110,0.5)] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark"
      >
        <span className="text-[9px] font-semibold tracking-[0.25em] uppercase">
          {t('explore')}
        </span>
        <motion.span
          aria-hidden
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="leading-none"
        >
          <ChevronDown size={20} strokeWidth={2.5} />
        </motion.span>
      </motion.button>
    </section>
  );
}

function Sparkles() {
  const shouldReduceMotion = useReducedMotion();

  // 20 golden dust motes scattered across the hero. Positions, sizes, timing all
  // derived deterministically per-index so SSR + client agree and the layout
  // feels organic rather than synchronized.
  const particles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => {
        const hash = (i * 2654435761) >>> 0;
        const top = ((hash & 0xff) % 86) + 6; // 6–92 %
        const left = (((hash >> 8) & 0xff) % 92) + 3; // 3–95 %
        const size = 1.5 + (((hash >> 16) & 0xff) % 28) / 10; // 1.5–4.3 px
        const duration = 7 + (((hash >> 20) & 0x0f) * 0.7); // 7–17 s
        const delay = ((hash >> 24) & 0x0f) * 0.5; // 0–7.5 s
        const driftY = -(35 + (((hash >> 4) & 0x3f) % 45)); // -35 to -80 px
        const driftX = ((hash >> 12) & 0x1f) - 16; // -16 to +15 px
        return { id: i, size, top, left, duration, delay, driftX, driftY };
      }),
    [],
  );

  if (shouldReduceMotion) {
    return (
      <>
        {particles.map(p => (
          <div
            key={p.id}
            aria-hidden
            className="absolute rounded-full pointer-events-none"
            style={{
              width: p.size,
              height: p.size,
              top: `${p.top}%`,
              left: `${p.left}%`,
              background: '#c9a96e',
              boxShadow: '0 0 6px rgba(201,169,110,0.6)',
              opacity: 0.45,
            }}
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
          className="absolute rounded-full pointer-events-none will-change-transform"
          style={{
            width: p.size,
            height: p.size,
            top: `${p.top}%`,
            left: `${p.left}%`,
            background: '#c9a96e',
            boxShadow: '0 0 6px rgba(201,169,110,0.65)',
          }}
          animate={{
            opacity: [0, 0.75, 0.75, 0],
            scale: [0.6, 1.1, 1.05, 0.7],
            y: [0, p.driftY * 0.5, p.driftY],
            x: [0, p.driftX, p.driftX * 0.4],
          }}
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
