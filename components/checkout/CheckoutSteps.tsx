'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

export type StepKey = 'shipping' | 'disclaimers' | 'payment' | 'done';

const ORDER: StepKey[] = ['shipping', 'disclaimers', 'payment', 'done'];

export default function CheckoutSteps({ current }: { current: StepKey }) {
  const t = useTranslations('checkout.steps');
  const currentIdx = ORDER.indexOf(current);

  return (
    <ol className="flex items-center gap-2 sm:gap-4 mb-8 overflow-x-auto" aria-label="Checkout progress">
      {ORDER.map((key, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <li key={key} className="flex items-center gap-2 sm:gap-3 text-xs whitespace-nowrap">
            <span
              className={`flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold tracking-wider border ${
                isDone
                  ? 'bg-gold-dark border-gold-dark text-cream'
                  : isActive
                  ? 'bg-charcoal border-charcoal text-cream'
                  : 'bg-cream border-bone text-mist'
              }`}
            >
              {isDone ? <Check size={14} /> : i + 1}
            </span>
            <span
              className={`hidden sm:inline tracking-wider uppercase ${
                isActive ? 'text-charcoal font-semibold' : isDone ? 'text-gold-dark' : 'text-mist'
              }`}
            >
              {t(key)}
            </span>
            {i < ORDER.length - 1 && <span className="h-px w-4 sm:w-8 bg-bone" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
