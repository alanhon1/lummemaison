'use client';

import { useState } from 'react';
import { X, Minus, Plus, Check, Send, Loader2 } from 'lucide-react';
import { submitProductRequest } from '@/app/manzura/requests/actions';

// Storefront "make a request" popup, shown when a product is out of stock. The
// customer picks how many units they want; the request is recorded so the owner
// can see demand before restocking (admin Requests page).
export default function RequestModal({
  productId,
  productName,
  option,
  onClose,
}: {
  productId: number;
  productName: string;
  option?: string;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await submitProductRequest({ productId, productName, option, quantity: qty });
      if (!res.ok) { setError(res.error); return; }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,10,0.72)', backdropFilter: 'blur(2px)' }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl p-6 md:p-8"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-mist hover:text-charcoal transition-colors"
        >
          <X size={20} />
        </button>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <Check size={24} />
            </div>
            <p className="font-display text-xl text-charcoal mb-2">Request received</p>
            <p className="text-sm text-mist mb-6">
              Thank you — we&apos;ve noted that you want {qty} of this item and will use it to plan our next restock.
            </p>
            <button onClick={onClose} className="btn-gold w-full">Close</button>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-gold-dark mb-2">Make a request</p>
            <h2 className="font-display text-xl text-charcoal leading-tight mb-1">{productName}</h2>
            {option && <p className="text-xs font-semibold text-gold-dark mb-3">{option}</p>}
            <p className="text-sm text-mist mb-6">
              This item is out of stock right now. Tell us how many you&apos;d like and we&apos;ll factor it into
              our next order.
            </p>

            <label className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-2">
              How many do you want?
            </label>
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 border border-bone rounded-sm flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
              >
                <Minus size={13} />
              </button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                className="w-20 text-center bg-white border border-bone rounded-md px-2 py-2 text-sm text-charcoal outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={() => setQty(q => q + 1)}
                className="w-9 h-9 border border-bone rounded-sm flex items-center justify-center hover:border-gold hover:text-gold transition-colors"
              >
                <Plus size={13} />
              </button>
            </div>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
