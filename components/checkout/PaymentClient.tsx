'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Copy, Check, MessageCircle } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

export default function PaymentClient() {
  const t = useTranslations('payment');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order') || 'LUM-UNKNOWN';

  const [order, setOrder] = useState<any>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('lumiere_order');
    if (stored) {
      try { setOrder(JSON.parse(stored)); } catch {}
    }
  }, []);

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const paymentMethod = order?.paymentMethod || 'wise';
  const total = order?.total || 0;

  return (
    <div className="space-y-8">
      {/* Success Header */}
      <div className="bg-white border border-bone rounded-sm p-8 text-center">
        <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-light mb-2">{t('orderPlaced')}</h1>
        <p className="text-sm text-mist mb-4">{t('instructions')}</p>
        <div className="inline-block bg-cream border border-bone rounded-sm px-6 py-3">
          <span className="text-xs text-mist mr-2">{t('orderNumber')}</span>
          <span className="font-semibold text-charcoal tracking-wider">{orderId}</span>
          <button
            onClick={() => copyToClipboard(orderId, 'orderId')}
            className="ml-2 text-mist hover:text-gold transition-colors"
          >
            {copied === 'orderId' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Payment Instructions */}
      {paymentMethod === 'wise' ? (
        <div className="bg-white border border-bone rounded-sm p-6">
          <h2 className="font-display text-xl font-light mb-4">{t('wise.title')}</h2>
          <div className="gold-divider mb-4" />
          <p className="text-sm text-charcoal mb-4">{t('wise.instructions')}</p>
          <div className="bg-cream border border-bone rounded-sm p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-mist">Account Name</span>
              <span className="font-semibold">{siteConfig.payment.wise.accountName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-mist">Reference</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{orderId}</span>
                <button onClick={() => copyToClipboard(orderId, 'wise-ref')} className="text-mist hover:text-gold">
                  {copied === 'wise-ref' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-mist">Amount</span>
              <span className="font-semibold text-gold">${total.toFixed(2)} USD</span>
            </div>
          </div>
          <p className="text-xs text-mist mt-4">{siteConfig.payment.wise.accountDetails}</p>
        </div>
      ) : (
        <div className="bg-white border border-bone rounded-sm p-6">
          <h2 className="font-display text-xl font-light mb-4">{t('usdt.title')}</h2>
          <div className="gold-divider mb-4" />
          <p className="text-sm text-charcoal mb-4">{t('usdt.instructions')}</p>
          <div className="bg-cream border border-bone rounded-sm p-4 space-y-3">
            <div>
              <span className="text-xs text-mist block mb-1">{t('usdt.network')}</span>
              <span className="font-semibold text-sm">{siteConfig.payment.usdt.network}</span>
            </div>
            <div>
              <span className="text-xs text-mist block mb-1">{t('usdt.address')}</span>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-white border border-bone px-3 py-2 flex-1 break-all">
                  {siteConfig.payment.usdt.address}
                </code>
                <button
                  onClick={() => copyToClipboard(siteConfig.payment.usdt.address, 'usdt')}
                  className="p-2 border border-bone hover:border-gold text-mist hover:text-gold flex-shrink-0 transition-colors"
                >
                  {copied === 'usdt' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-bone">
              <span className="text-mist">Amount</span>
              <span className="font-semibold text-gold">${total.toFixed(2)} USDT</span>
            </div>
          </div>
        </div>
      )}

      {/* After Payment */}
      <div className="bg-obsidian text-cream p-6">
        <p className="text-sm leading-relaxed mb-4">{t('afterPayment')}</p>
        <a
          href={`${siteConfig.social.whatsapp}?text=${encodeURIComponent(`Payment confirmation for order: ${orderId}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] text-white text-xs font-semibold tracking-wider uppercase hover:bg-[#20bd5a] transition-colors"
        >
          <MessageCircle size={14} />
          Send Payment Confirmation
        </a>
      </div>

      {/* Order Summary */}
      {order && (
        <div className="bg-white border border-bone rounded-sm p-6">
          <h2 className="font-display text-xl font-light mb-4">{t('orderDetails')}</h2>
          <div className="gold-divider mb-4" />
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <span className="text-xs text-mist block">Name</span>
              <span>{order.firstName} {order.lastName}</span>
            </div>
            <div>
              <span className="text-xs text-mist block">Company</span>
              <span>{order.company || '—'}</span>
            </div>
            <div>
              <span className="text-xs text-mist block">Email</span>
              <span>{order.email}</span>
            </div>
            <div>
              <span className="text-xs text-mist block">Country</span>
              <span>{order.country}</span>
            </div>
          </div>
          {order.items?.length > 0 && (
            <div className="border-t border-bone pt-4 space-y-2">
              {order.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span className="text-mist line-clamp-1">{item.name} × {item.quantity}</span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-bone">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-center">
        <Link href={`/${locale}`} className="btn-secondary text-xs">
          Return to Home
        </Link>
      </div>
    </div>
  );
}
