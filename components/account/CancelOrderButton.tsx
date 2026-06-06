'use client';

import { useState, useTransition } from 'react';
import { cancelOrder } from '@/app/[locale]/account/orders/[seq]/actions';

export default function CancelOrderButton({
  orderId,
  label,
  confirmText,
  cancelText,
}: {
  orderId: number;
  label: string;
  confirmText: string;
  cancelText: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if (!result.ok) {
        setError(result.error ?? 'Could not cancel.');
        setConfirming(false);
      }
      // On success the page revalidates and re-renders with cancelled status.
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm text-charcoal">{confirmText}</p>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs border border-rose-400 text-rose-600 hover:bg-rose-50 px-4 py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {isPending ? '…' : label}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs border border-bone text-mist hover:text-charcoal px-4 py-1.5 rounded transition-colors"
          >
            {cancelText}
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-mist hover:text-rose-600 underline underline-offset-2 transition-colors"
    >
      {label}
    </button>
  );
}
