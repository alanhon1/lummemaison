'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { X, Minus, Plus, Check, Send, Loader2, LogIn } from 'lucide-react';
import { submitProductRequest } from '@/app/manzura/requests/actions';
import { createClient } from '@/lib/supabase/browser';
import { localePath } from '@/lib/i18n';

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
  const locale = useLocale();
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  // 'checking' until we know; 'in' = signed in; 'out' = must log in first.
  const [auth, setAuth] = useState<'checking' | 'in' | 'out'>('checking');

  // A request must be tied to a customer account. Check the session on open so
  // we can show the login prompt instead of the form when signed out. The
  // server action enforces this too — this is just UX.
  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => { if (active) setAuth(data.user ? 'in' : 'out'); })
      .catch(() => { if (active) setAuth('out'); });
    return () => { active = false; };
  }, []);

  async function submit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await submitProductRequest({ productId, productName, option, quantity: qty });
      if (!res.ok) {
        if (res.code === 'auth') { setAuth('out'); return; }
        setError(res.error);
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  // Render through a portal to <body> so the fixed overlay is positioned against
  // the viewport — not a transformed ancestor (e.g. the page-enter <main>
  // animation), which would otherwise make `inset-0` cover the full page height
  // and push the centered card off-screen (visible blur, invisible modal). The
  // modal only mounts after a client click, so document.body is always present.
  return createPortal(
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

        {auth === 'checking' ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-gold" />
          </div>
        ) : auth === 'out' ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-gold/10 text-gold-dark flex items-center justify-center mx-auto mb-4">
              <LogIn size={22} />
            </div>
            <p className="font-display text-xl text-charcoal mb-2">Please log in</p>
            <p className="text-sm text-mist mb-6">
              You need an account to make a request. Log in or create one — it only takes a moment.
            </p>
            <Link href={localePath(locale, '/account/login')} className="btn-gold w-full inline-flex items-center justify-center gap-2">
              <LogIn size={15} />
              Log in
            </Link>
          </div>
        ) : done ? (
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
    </div>,
    document.body,
  );
}
