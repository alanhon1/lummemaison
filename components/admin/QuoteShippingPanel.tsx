'use client';

import { useState, useTransition } from 'react';
import { openOrderPayment } from '@/app/manzura/orders/actions';

interface Props {
  orderId: number;
  subtotalCents: number;
  discountCents: number;
}

function formatUSD(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export default function QuoteShippingPanel({ orderId, subtotalCents, discountCents }: Props) {
  const [shippingInput, setShippingInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Parse the input (dollars) → cents
  const shippingDollars = parseFloat(shippingInput);
  const shippingCents = Number.isFinite(shippingDollars) && shippingDollars >= 0
    ? Math.round(shippingDollars * 100)
    : null;

  const productAfterDiscount = subtotalCents - discountCents;
  const previewTotal = shippingCents !== null ? productAfterDiscount + shippingCents : null;

  function handleOpen() {
    if (shippingCents === null) {
      setError('Enter a valid shipping amount (0 or more).');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await openOrderPayment(orderId, shippingCents);
      if (!res.ok) setError(res.error);
      // On success revalidatePath in the action refreshes the page server-side.
    });
  }

  return (
    <section className="bg-amber-50 border border-amber-300 rounded-lg p-5">
      <h2 className="font-display text-lg text-charcoal mb-1">Set shipping &amp; open payment</h2>
      <p className="text-xs text-amber-800 mb-4">
        This order is awaiting a shipping quote. Enter the real shipping cost, then press
        <span className="font-semibold"> Open payment</span> to set the final total and notify the customer.
      </p>

      <div className="space-y-4">
        {/* Shipping input */}
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">
            Shipping cost (USD)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-charcoal">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={shippingInput}
              onChange={e => { setShippingInput(e.target.value); setError(null); }}
              className="w-36 border border-bone px-3 py-2 text-sm outline-none focus:border-gold font-mono bg-white"
              disabled={pending}
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="bg-white border border-bone rounded p-4 text-sm space-y-1.5">
          <div className="flex justify-between text-charcoal">
            <span className="text-mist">Subtotal</span>
            <span>{formatUSD(subtotalCents)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Bulk discount (15%)</span>
            <span>-{formatUSD(discountCents)}</span>
          </div>
          <div className="flex justify-between text-charcoal">
            <span className="text-mist">Shipping</span>
            <span>{shippingCents !== null ? formatUSD(shippingCents) : '—'}</span>
          </div>
          <div className="flex justify-between text-charcoal font-semibold border-t border-bone pt-2 mt-1">
            <span className="uppercase tracking-widest text-xs">New total</span>
            <span className="font-display text-base">
              {previewTotal !== null ? formatUSD(previewTotal) : '—'}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pending || shippingCents === null}
            onClick={handleOpen}
            className="btn-gold text-xs disabled:opacity-60"
          >
            {pending ? 'Opening payment…' : 'Open payment'}
          </button>
          <span className="text-[11px] text-mist">
            Customer will receive an email with the final total and a payment link.
          </span>
        </div>

        {error && (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
