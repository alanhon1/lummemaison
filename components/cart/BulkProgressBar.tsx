'use client';

// Awareness bar for the $2,500+ bulk discount. Purely informational/motivational
// — it never applies the discount itself (that stays at the payment-step gate).
// Shown in the cart drawer (CartPanel) and the cart page (CartPageClient).
// Amounts are USD: the bulk threshold is a fixed USD wholesale milestone, which
// also matches the cart page's USD display and the discount's own definition.

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useAnimationControls } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useCartStore } from '@/lib/store';
import { BULK_THRESHOLD_CENTS } from '@/lib/checkout/bulk';

const THRESHOLD_USD = BULK_THRESHOLD_CENTS / 100; // 2500

const usd0 = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function BulkProgressBar() {
  const t = useTranslations('cart.bulk');
  const { items, totalPrice } = useCartStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const subtotal = mounted ? totalPrice() : 0;
  const unlocked = subtotal >= THRESHOLD_USD;
  const pct = THRESHOLD_USD > 0 ? Math.min(100, (subtotal / THRESHOLD_USD) * 100) : 0;
  const remaining = Math.max(0, THRESHOLD_USD - subtotal);

  // Fire a single soft gold glow + nudge only the moment the cart crosses the
  // threshold — not on every re-render while it stays unlocked.
  const controls = useAnimationControls();
  const prevUnlocked = useRef(false);
  useEffect(() => {
    if (mounted && unlocked && !prevUnlocked.current) {
      controls.start({
        boxShadow: [
          '0 0 0 rgba(193,154,82,0)',
          '0 0 18px rgba(193,154,82,0.55)',
          '0 0 0 rgba(193,154,82,0)',
        ],
        scale: [1, 1.015, 1],
        transition: { duration: 0.9, ease: 'easeOut' },
      });
    }
    prevUnlocked.current = unlocked;
  }, [mounted, unlocked, controls]);

  if (!mounted || items.length === 0 || subtotal <= 0) return null;

  return (
    <motion.div
      animate={controls}
      className="rounded-md border border-bone bg-cream/60 px-3.5 py-3"
    >
      <p
        className={`flex items-center gap-1.5 text-[11px] sm:text-xs font-medium leading-snug ${
          unlocked ? 'text-gold-dark' : 'text-charcoal'
        }`}
      >
        <Sparkles size={13} className="shrink-0 text-gold-dark" aria-hidden />
        <span>{unlocked ? t('unlocked') : t('progress', { amount: usd0(remaining) })}</span>
      </p>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bone">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold-dark transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {!unlocked && (
        <p className="mt-1 text-right text-[10px] text-mist tabular-nums">
          {usd0(subtotal)} / {usd0(THRESHOLD_USD)}
        </p>
      )}
    </motion.div>
  );
}
