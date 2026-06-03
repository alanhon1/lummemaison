'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { ORDER_STAGES, stageIndex, isCancelled, type OrderStage } from '@/lib/orders/status';

// Five-stage horizontal stepper. Adapted from components/checkout/CheckoutSteps.tsx
// — same visual vocabulary (charcoal active, gold-dark completed, mist pending)
// so the brand tone stays consistent.
//
// The labels live in `account.orders.stepper.*` (en + ru). Cancelled orders
// render a separate banner instead of the stepper.

export default function OrderStepper({ status }: { status: string }) {
  const t = useTranslations('account.orders');

  if (isCancelled(status)) {
    return (
      <div className="bg-stone-100 border border-stone-300 rounded-md px-4 py-3 mb-6">
        <p className="text-sm text-stone-600">{t('cancelled')}</p>
      </div>
    );
  }

  const currentIdx = stageIndex(status);

  return (
    <ol
      className="flex items-center gap-1 sm:gap-2 md:gap-3 mb-6 overflow-x-auto pb-1"
      aria-label="Order progress"
    >
      {ORDER_STAGES.map((key, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <li key={key} className="flex items-center gap-1.5 sm:gap-2 text-xs whitespace-nowrap">
            <span
              className={`flex items-center justify-center rounded-full border transition-all duration-300 ${
                isDone
                  ? 'w-7 h-7 bg-gold-dark border-gold-dark text-cream shadow-sm'
                  : isActive
                  ? 'w-8 h-8 bg-charcoal border-charcoal text-cream shadow-md scale-105'
                  : 'w-7 h-7 bg-cream border-bone text-mist'
              }`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={`text-[11px] font-semibold tracking-wider transition-opacity ${isDone ? 'opacity-100' : 'opacity-100'}`}>
                {isDone ? <Check size={14} /> : i + 1}
              </span>
            </span>
            <span
              className={`hidden sm:inline tracking-wider uppercase transition-colors ${
                isActive ? 'text-charcoal font-semibold' : isDone ? 'text-gold-dark' : 'text-mist'
              }`}
            >
              {labelFor(t, key)}
            </span>
            {i < ORDER_STAGES.length - 1 && (
              <span
                className={`h-px w-3 sm:w-6 md:w-10 transition-colors ${
                  i < currentIdx ? 'bg-gold-dark' : 'bg-bone'
                }`}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function labelFor(t: ReturnType<typeof useTranslations>, key: OrderStage): string {
  try {
    return t(`stepper.${key}`);
  } catch {
    return key;
  }
}
