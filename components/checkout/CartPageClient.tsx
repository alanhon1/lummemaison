'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, AlertTriangle } from 'lucide-react';
import { useCartStore, cartLineKey } from '@/lib/store';
import { useCartAvailability } from '@/lib/useCartAvailability';
import { localePath } from '@/lib/i18n';
import BulkProgressBar from '@/components/cart/BulkProgressBar';
import { useCartCaps } from '@/lib/cap-store';
import RequestModal from '@/components/catalogue/RequestModal';
import type { CartItem } from '@/lib/store';

export default function CartPageClient() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCartStore();
  const { isBlocked, blockLabelOf, anyBlocked } = useCartAvailability();
  const { capOf, perOrderOf } = useCartCaps();
  const [requestItem, setRequestItem] = useState<CartItem | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || items.length === 0) {
    return (
      <div className="py-20 text-center">
        <ShoppingBag size={48} className="text-bone mx-auto mb-4" />
        <p className="font-display text-2xl font-light mb-3">{t('empty')}</p>
        <p className="text-sm text-mist mb-8">{t('emptyHint')}</p>
        <Link href={localePath(locale, '/catalogue')} className="btn-primary">
          {t('continueShopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Items */}
      <div className="order-2 lg:order-1 lg:col-span-2 space-y-3">
        {items.map(item => {
          const lineKey = cartLineKey(item);
          const cap = capOf(item);
          const atCap = typeof cap === 'number' && item.quantity >= cap;
          // The per-order limit is the binding constraint when it equals the
          // effective cap (i.e. stock isn't the tighter of the two).
          const perOrder = perOrderOf(item);
          const perOrderBinding = typeof perOrder === 'number' && perOrder > 0 && cap === perOrder;
          return (
          <div key={lineKey} className="flex gap-4 p-4 bg-white border border-bone rounded-sm">
            <div className="w-20 h-20 bg-cream flex-shrink-0 flex items-center justify-center">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <ShoppingBag size={24} className="text-bone" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-charcoal line-clamp-2">{item.name}</h3>
              {item.specification && (
                <p className="text-xs text-mist mt-0.5 line-clamp-1">{item.specification}</p>
              )}
              {item.option && (
                <p className="text-xs font-semibold text-gold-dark mt-0.5">{item.option}</p>
              )}
              <p className="text-base font-semibold text-gold mt-1">${item.price.toFixed(2)}</p>
              {isBlocked(item.id) && (
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-red-600">
                  <AlertTriangle size={12} aria-hidden />
                  {blockLabelOf(item.id)}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => updateQuantity(lineKey, item.quantity - 1)}
                  className="w-7 h-7 border border-bone rounded-sm flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
                >
                  <Minus size={11} />
                </button>
                <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => { if (!atCap) updateQuantity(lineKey, item.quantity + 1); }}
                  disabled={atCap}
                  className={`w-7 h-7 border border-bone rounded-sm flex items-center justify-center transition-colors ${
                    atCap ? 'opacity-40 cursor-not-allowed' : 'hover:border-gold hover:text-gold'
                  }`}
                >
                  <Plus size={11} />
                </button>
              </div>
              {atCap && (
                perOrderBinding ? (
                  <p className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-mist">
                    Limited to {perOrder} per order
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRequestItem(item)}
                    className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-gold-dark hover:text-gold"
                  >
                    Only {cap} in stock · Request more
                  </button>
                )
              )}
            </div>
            <div className="flex flex-col items-end justify-between">
              <button
                onClick={() => removeItem(lineKey)}
                className="text-mist hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
              <p className="text-sm font-semibold text-charcoal">
                ${(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          </div>
          );
        })}

        <div className="flex justify-between pt-2">
          <Link
            href={localePath(locale, '/catalogue')}
            className="text-xs text-mist hover:text-gold transition-colors flex items-center gap-1"
          >
            ← {t('continueShopping')}
          </Link>
          <button
            onClick={clearCart}
            className="text-xs text-mist hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <Trash2 size={12} />
            {t('clear')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="order-1 lg:order-2 bg-white border border-bone rounded-sm p-6 h-fit">
        <h2 className="font-display text-xl font-light mb-6">Order Summary</h2>
        <div className="space-y-3 mb-6 pb-6 border-b border-bone">
          {items.map(item => (
            <div key={cartLineKey(item)} className="flex justify-between text-xs">
              <span className="text-mist line-clamp-1 flex-1 mr-2">
                {item.name}{item.option ? ` (${item.option})` : ''} × {item.quantity}
              </span>
              <span className="font-semibold text-charcoal flex-shrink-0">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="mb-6">
          <BulkProgressBar />
        </div>
        <div className="flex justify-between items-center mb-8">
          <span className="text-sm font-semibold">{t('total')}</span>
          <span className="font-display text-2xl font-light">${totalPrice().toFixed(2)}</span>
        </div>
        {anyBlocked ? (
          <>
            <button
              type="button"
              disabled
              className="btn-primary w-full text-center flex items-center justify-center gap-2 opacity-50 cursor-not-allowed"
            >
              {t('checkout')}
              <ArrowRight size={14} />
            </button>
            <p className="text-xs text-red-600 text-center mt-4 flex items-center justify-center gap-1">
              <AlertTriangle size={12} aria-hidden />
              Remove the unavailable item(s) above to continue
            </p>
          </>
        ) : (
          <>
            <Link
              href={localePath(locale, '/checkout')}
              className="btn-primary w-full text-center flex items-center justify-center gap-2"
            >
              {t('checkout')}
              <ArrowRight size={14} />
            </Link>
            <p className="text-xs text-mist text-center mt-4">
              + Shipping calculated at checkout
            </p>
          </>
        )}
      </div>
      {requestItem && (
        <RequestModal
          productId={requestItem.id}
          productName={requestItem.name}
          option={requestItem.option}
          onClose={() => setRequestItem(null)}
        />
      )}
    </div>
  );
}
