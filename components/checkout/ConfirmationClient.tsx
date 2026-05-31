'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { clearDraft } from '@/lib/checkout/state';
import { useCartStore } from '@/lib/store';

interface OrderItem {
  product_id: number;
  product_name: string;
  unit_cents: number;
  quantity: number;
  line_cents: number;
}

interface ShippingAddress {
  street: string;
  city: string;
  state_province?: string | null;
  postal_code: string;
  country: string;
}

export interface OrderView {
  order_number: string;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fedex_account: string | null;
  shipping_address: ShippingAddress;
  created_at: string;
  status: string;
  items: OrderItem[];
}

interface Props {
  order: OrderView;
  countryName: string;
  adminEmail: string;
}

function formatUSD(cents: number) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function ConfirmationClient({ order, countryName, adminEmail }: Props) {
  const t = useTranslations('checkout.confirmation');
  const locale = useLocale();
  const clearCart = useCartStore(s => s.clearCart);

  // Clear the cart + draft once the customer lands here — the order has been
  // persisted, so the localStorage draft and the cart shouldn't survive a
  // refresh.
  useEffect(() => {
    clearDraft();
    clearCart();
  }, [clearCart]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-bone rounded-lg p-6 md:p-8 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-gold-dark mb-2">{t('thanks')}</p>
        <h1 className="font-display italic text-3xl md:text-4xl text-charcoal mb-3">
          {t('hello', { name: order.customer_name })}
        </h1>
        <p className="text-sm text-mist">{t('received', { number: order.order_number })}</p>
      </div>

      <div className="bg-cream border border-bone rounded-lg p-5 md:p-6">
        <p className="text-sm text-charcoal whitespace-pre-line">
          {t('paymentReminder', { email: adminEmail })}
        </p>
      </div>

      <article className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <h2 className="font-display italic text-xl text-charcoal mb-4">{t('items')}</h2>
        <ul className="space-y-2 text-sm">
          {order.items.map(item => (
            <li key={item.product_id} className="flex justify-between">
              <span className="text-charcoal pr-3 line-clamp-1">
                {item.product_name} <span className="text-mist">× {item.quantity}</span>
              </span>
              <span className="text-charcoal whitespace-nowrap">{formatUSD(item.line_cents)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-bone mt-3 pt-3 space-y-1.5 text-sm">
          <Row label={t('subtotal')} value={formatUSD(order.subtotal_cents)} />
          <Row label={t('shipping')} value={formatUSD(order.shipping_cents)} />
          <Row label={t('total')} value={formatUSD(order.total_cents)} strong />
        </div>
      </article>

      <article className="bg-white border border-bone rounded-lg p-5 md:p-6">
        <h2 className="font-display italic text-xl text-charcoal mb-4">{t('shippingTo')}</h2>
        <p className="text-sm text-charcoal whitespace-pre-line leading-relaxed">
          {[
            order.customer_name,
            order.shipping_address.street,
            [order.shipping_address.city, order.shipping_address.state_province, order.shipping_address.postal_code]
              .filter(Boolean)
              .join(', '),
            countryName,
          ]
            .filter(Boolean)
            .join('\n')}
        </p>
        <p className="text-xs text-mist mt-3">
          {order.customer_email} · {order.customer_phone}
        </p>
        {order.fedex_account && (
          <p className="text-xs text-mist mt-1">
            {t('fedexAccount')}: <span className="font-mono">{order.fedex_account}</span>
          </p>
        )}
      </article>

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <Link
          href={`/${locale}/catalogue`}
          className="text-xs font-semibold tracking-widest uppercase px-6 py-3 rounded-md border border-charcoal/30 text-charcoal hover:border-gold-dark hover:text-gold-dark transition-colors text-center"
        >
          {t('continueShopping')}
        </Link>
        <Link href={`/${locale}/account`} className="btn-gold text-center">
          {t('viewOrders')}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={strong ? 'text-charcoal font-semibold tracking-wider uppercase text-xs' : 'text-mist'}>
        {label}
      </span>
      <span className={strong ? 'font-display text-xl text-charcoal' : 'text-charcoal'}>
        {value}
      </span>
    </div>
  );
}
