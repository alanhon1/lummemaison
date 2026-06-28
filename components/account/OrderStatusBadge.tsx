'use client';

import { useTranslations } from 'next-intl';
import type { OrderStatus } from '@/lib/orders/status';

// Status → Tailwind classes (background + text). Kept inline so the palette
// is reviewable at a glance.
const STYLES: Record<OrderStatus, string> = {
  quote_pending:   'bg-violet-50 text-violet-700 border border-violet-200',
  awaiting_payment:'bg-orange-50 text-orange-700 border border-orange-200',
  order_received:  'bg-cream text-gold-dark border border-gold/30',
  payment_verified:'bg-blue-50 text-blue-700 border border-blue-200',
  packaging:       'bg-amber-50 text-amber-700 border border-amber-200',
  shipped:         'bg-emerald-50 text-emerald-700 border border-emerald-200',
  delivered:       'bg-charcoal text-cream border border-charcoal',
  cancelled:       'bg-stone-100 text-stone-500 border border-stone-300 line-through decoration-stone-400',
};

export default function OrderStatusBadge({ status }: { status: string }) {
  const t = useTranslations('account.orders.status');
  const cls = STYLES[status as OrderStatus] ?? STYLES.order_received;
  // Fall back to the raw key if the translation is missing rather than throwing.
  let label: string;
  try {
    label = t(status as OrderStatus);
  } catch {
    label = status;
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-widest uppercase ${cls}`}
    >
      {label}
    </span>
  );
}
