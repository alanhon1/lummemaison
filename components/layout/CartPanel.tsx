'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCartStore, cartLineKey } from '@/lib/store';
import { useCartStock } from '@/lib/useCartStock';
import { useCurrencyStore, formatPrice } from '@/lib/currency-store';
import { localePath } from '@/lib/i18n';

export default function CartPanel() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { items, isOpen, closeCart, removeItem, updateQuantity, clearCart, totalItems, totalPrice } = useCartStore();
  const { isBackorder } = useCartStock();
  const { currency } = useCurrencyStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const itemCount = mounted ? totalItems() : 0;
  const hasItems = mounted && items.length > 0;
  const open = mounted && isOpen;

  return (
    <>
      {/* Overlay */}
      <div
        className={`overlay ${open ? 'visible' : ''}`}
        onClick={closeCart}
      />

      {/* Panel */}
      <aside className={`cart-panel ${open ? 'open' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bone">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-gold" />
            <h2 className="font-display text-xl font-light">{t('title')}</h2>
            {itemCount > 0 && (
              <span className="text-xs text-mist">({itemCount} {t('items')})</span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="p-1 text-mist hover:text-charcoal transition-colors"
            aria-label={t('continueShopping')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <ShoppingBag size={40} className="text-bone mb-4" />
            <p className="font-display text-xl font-light mb-2">{t('empty')}</p>
            <p className="text-sm text-mist mb-6">{t('emptyHint')}</p>
            <button onClick={closeCart} className="btn-primary text-xs px-6 py-3">
              {t('continueShopping')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-4">
              {items.map(item => {
                const backorder = isBackorder(item.id);
                const lineKey = cartLineKey(item);
                return (
                <div key={lineKey} className="flex gap-4 px-6 py-4 border-b border-bone/50">
                  {/* Image */}
                  <div
                    className="w-16 h-16 flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'linear-gradient(145deg, #f5f0e8, #ede5d4)' }}
                  >
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span
                        className="font-display text-base font-light"
                        style={{ color: 'rgba(160,130,80,0.5)' }}
                      >
                        {String(item.id).padStart(3, '0')}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-charcoal leading-tight line-clamp-2 mb-1">
                      {item.name}
                    </p>
                    {item.specification ? (
                      <p className="text-xs text-mist line-clamp-1">{item.specification}</p>
                    ) : null}
                    {item.option ? (
                      <p className="text-xs font-semibold text-gold-dark">{item.option}</p>
                    ) : null}
                    <p className="text-sm font-semibold text-gold mt-1">{formatPrice(item.price, currency)}</p>
                    {backorder && (
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mt-1">{t('backorder')}</p>
                    )}

                    {/* Quantity */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(lineKey, item.quantity - 1)}
                        className="w-6 h-6 border border-bone rounded-sm flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="text-xs font-semibold w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(lineKey, item.quantity + 1)}
                        className="w-6 h-6 border border-bone rounded-sm flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
                      >
                        <Plus size={10} />
                      </button>
                      <button
                        onClick={() => removeItem(lineKey)}
                        className="ml-auto text-mist hover:text-red-500 transition-colors"
                        aria-label={t('remove')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-bone p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-mist">{t('total')}</span>
                <span className="font-display text-xl font-light">
                  {formatPrice(totalPrice(), currency)}
                </span>
              </div>
              <Link
                href={localePath(locale, '/checkout')}
                onClick={closeCart}
                className="btn-primary w-full text-center block"
              >
                {t('checkout')}
              </Link>
              <button
                onClick={clearCart}
                className="w-full text-xs text-mist hover:text-charcoal transition-colors text-center"
              >
                {t('clear')}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
