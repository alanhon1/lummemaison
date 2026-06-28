'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Undo2, X, Camera, Trash2 } from 'lucide-react';
import { ORDER_STAGES, stageIndex, type OrderStatus } from '@/lib/orders/status';
import { CARRIERS, type CarrierKey } from '@/lib/orders/carriers';
import { updateOrderStatus, markOrderShipped, deleteOrder } from '@/app/manzura/orders/actions';

// Visible labels (admin only, English) — order_received → Received, etc.
const ADMIN_LABEL: Record<OrderStatus, string> = {
  quote_pending: 'Quote pending',
  awaiting_payment: 'Awaiting payment',
  order_received: 'Received',
  payment_verified: 'Payment verified',
  packaging: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

interface Props {
  orderId: number;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shipmentPhotoPath: string | null;
}

export default function AdminOrderStatusPanel({
  orderId,
  status,
  carrier,
  trackingNumber,
  shipmentPhotoPath,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shipFormOpen, setShipFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After a "not enough stock" block, the next click on that same stage offers
  // to auto-add the missing stock (the user's "2nd click" behaviour).
  const [autoAddArmed, setAutoAddArmed] = useState<OrderStatus | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);

  const idx = stageIndex(status);
  const isCancelled = status === 'cancelled';
  const isDelivered = status === 'delivered';
  const isShipped = status === 'shipped';

  const nextStage: OrderStatus | null = (() => {
    if (isCancelled || isDelivered) return null;
    const i = idx;
    if (i + 1 >= ORDER_STAGES.length) return null;
    return ORDER_STAGES[i + 1];
  })();
  const prevStage: OrderStatus | null = (() => {
    if (isCancelled) return null;
    if (idx <= 0) return null;
    return ORDER_STAGES[idx - 1];
  })();

  function advanceTo(next: OrderStatus, autoAddStock = false) {
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, next, autoAddStock ? { autoAddStock: true } : undefined);
      if (!res.ok) {
        setError(res.error);
        // Arm the auto-add path so the admin's next click on this stage can top
        // up the missing stock instead of being blocked again.
        if (res.error.includes('not enough stock')) setAutoAddArmed(next);
        return;
      }
      setAutoAddArmed(null);
      router.refresh();
    });
  }

  // Click handler for a forward "Mark <stage>" button: first time it just tries;
  // once blocked for stock it asks to auto-add on the next click.
  function handleAdvanceClick(next: OrderStatus) {
    if (autoAddArmed === next) {
      const ok = confirm(
        `Not enough stock for this order.\n\nAuto-add the missing stock and move to ${ADMIN_LABEL[next]}? ` +
          `The added quantity is recorded in stock history as "Auto add stock".`,
      );
      if (ok) advanceTo(next, true);
      return;
    }
    advanceTo(next);
  }

  async function handleShipSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await markOrderShipped(formData);
      if (!res.ok) setError(res.error);
      else {
        setShipFormOpen(false);
        setPhotoName(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="bg-white border border-bone rounded-lg p-5 md:p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg text-charcoal">Status</h2>
        {isCancelled && (
          <span className="text-[10px] uppercase tracking-widest text-stone-500 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded-full">
            Cancelled
          </span>
        )}
      </div>

      {/* Stepper */}
      {!isCancelled && (
        <ol className="flex items-center gap-1 sm:gap-2 mb-5 overflow-x-auto pb-1" aria-label="Order progress">
          {ORDER_STAGES.map((key, i) => {
            const isDone = i < idx;
            const isActive = i === idx;
            return (
              <li key={key} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <span
                  className={`flex items-center justify-center rounded-full border transition-all duration-300 ${
                    isDone
                      ? 'w-7 h-7 bg-gold-dark border-gold-dark text-cream'
                      : isActive
                      ? 'w-8 h-8 bg-charcoal border-charcoal text-cream scale-105 shadow-md'
                      : 'w-7 h-7 bg-cream border-bone text-mist'
                  }`}
                >
                  <span className="text-[11px] font-semibold">{isDone ? <Check size={14} /> : i + 1}</span>
                </span>
                <span
                  className={`hidden md:inline tracking-wider uppercase text-[10px] transition-colors ${
                    isActive ? 'text-charcoal font-semibold' : isDone ? 'text-gold-dark' : 'text-mist'
                  }`}
                >
                  {ADMIN_LABEL[key]}
                </span>
                {i < ORDER_STAGES.length - 1 && (
                  <span
                    className={`h-px w-3 sm:w-6 transition-colors ${i < idx ? 'bg-gold-dark' : 'bg-bone'}`}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Existing shipping metadata (read-only summary if already shipped) */}
      {isShipped && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 mb-4 text-xs text-emerald-900">
          <div><span className="text-emerald-700">Carrier:</span> {CARRIERS[carrier as CarrierKey]?.label ?? carrier}</div>
          <div><span className="text-emerald-700">Tracking:</span> <span className="font-mono">{trackingNumber}</span></div>
          {shipmentPhotoPath && <div><span className="text-emerald-700">Photo:</span> <span className="font-mono">{shipmentPhotoPath}</span></div>}
        </div>
      )}

      {/* Action buttons */}
      {!isCancelled && !isDelivered && (
        <div className="flex flex-wrap items-center gap-2">
          {nextStage && nextStage !== 'shipped' && !isShipped && (
            <button
              type="button"
              disabled={pending}
              onClick={() => handleAdvanceClick(nextStage)}
              className={`text-xs inline-flex items-center gap-1.5 disabled:opacity-60 ${
                autoAddArmed === nextStage
                  ? 'border border-amber-400 bg-amber-50 text-amber-800 px-3 py-1.5 rounded'
                  : 'btn-gold'
              }`}
            >
              <ArrowRight size={13} />
              {autoAddArmed === nextStage ? `Auto-add stock & ${ADMIN_LABEL[nextStage]}` : `Mark ${ADMIN_LABEL[nextStage]}`}
            </button>
          )}
          {nextStage === 'shipped' && !shipFormOpen && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setShipFormOpen(true)}
              className="btn-gold text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <ArrowRight size={13} />
              Mark Shipped…
            </button>
          )}
          {isShipped && (
            <button
              type="button"
              disabled={pending}
              onClick={() => advanceTo('delivered')}
              className="btn-gold text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <ArrowRight size={13} />
              Mark Delivered
            </button>
          )}
          {prevStage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                // Rolling back past `shipped` destroys the ship metadata
                // (carrier / tracking / photo) — warn so it's not a surprise.
                const destructive = isShipped || status === 'delivered';
                if (
                  destructive &&
                  !confirm(
                    `Roll back to ${ADMIN_LABEL[prevStage]}? This will clear the carrier, tracking number, and shipment photo.`,
                  )
                ) {
                  return;
                }
                advanceTo(prevStage);
              }}
              className="text-xs text-mist hover:text-charcoal inline-flex items-center gap-1.5 border border-bone px-3 py-1.5"
            >
              <Undo2 size={13} />
              Roll back to {ADMIN_LABEL[prevStage]}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm('Cancel this order?')) advanceTo('cancelled');
            }}
            className="text-xs text-rose-700 hover:text-rose-900 inline-flex items-center gap-1.5 border border-rose-200 px-3 py-1.5 ml-auto"
          >
            <X size={13} />
            Cancel order
          </button>
        </div>
      )}

      {/* Cancelled or delivered → finalised. Delivered still allows a single
          step back to Shipped (keeps carrier/tracking/photo); both allow a
          full reopen to Received. */}
      {(isCancelled || isDelivered) && (
        <div className="flex flex-wrap gap-2">
          {/* Single-step rollback is only valid while the shipment metadata is
              still intact (the server enforces this too). */}
          {isDelivered && carrier && trackingNumber && shipmentPhotoPath && (
            <button
              type="button"
              disabled={pending}
              onClick={() => advanceTo('shipped')}
              className="text-xs text-mist hover:text-charcoal inline-flex items-center gap-1.5 border border-bone px-3 py-1.5"
            >
              <Undo2 size={13} />
              Roll back to Shipped
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => advanceTo('order_received')}
            className="text-xs text-mist hover:text-charcoal border border-bone px-3 py-1.5"
          >
            Reopen → Received
          </button>
          {isCancelled && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm('Delete this cancelled order permanently? This removes its items, messages, and stock history. This cannot be undone.')) return;
                if (!confirm('Are you absolutely sure? This is permanent.')) return;
                setError(null);
                startTransition(async () => {
                  const res = await deleteOrder(orderId);
                  if (!res.ok) setError(res.error);
                  else router.push('/manzura/orders');
                });
              }}
              className="text-xs text-rose-700 hover:text-rose-900 inline-flex items-center gap-1.5 border border-rose-200 px-3 py-1.5 ml-auto"
            >
              <Trash2 size={13} />
              Delete order
            </button>
          )}
        </div>
      )}

      {/* Shipped form */}
      {shipFormOpen && (
        <form
          action={handleShipSubmit}
          className="mt-5 border-t border-bone pt-5 space-y-3"
          encType="multipart/form-data"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">Carrier</label>
              <select
                name="carrier"
                required
                defaultValue=""
                className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold bg-white"
              >
                <option value="" disabled>Choose carrier…</option>
                {Object.entries(CARRIERS).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">Tracking number</label>
              <input
                type="text"
                name="trackingNumber"
                required
                className="w-full border border-bone px-3 py-2 text-sm outline-none focus:border-gold font-mono"
                placeholder="e.g. 1234567890"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-mist mb-1.5">Shipment photo (required)</label>
            <input
              ref={photoInputRef}
              type="file"
              name="photo"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={e => setPhotoName(e.target.files?.[0]?.name ?? null)}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="btn-secondary text-xs inline-flex items-center gap-1.5"
              >
                <Camera size={13} />
                {photoName ? 'Change photo' : 'Choose photo…'}
              </button>
              {photoName && <span className="text-xs text-charcoal truncate max-w-[200px]">{photoName}</span>}
            </div>
            <p className="text-[10px] text-mist mt-1">Stored privately in the shipment-photos bucket. Customer sees it via a signed URL.</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={pending || !photoName} className="btn-gold text-xs disabled:opacity-60">
              {pending ? 'Shipping…' : 'Submit & notify customer'}
            </button>
            <button
              type="button"
              onClick={() => { setShipFormOpen(false); setPhotoName(null); }}
              disabled={pending}
              className="text-xs text-mist hover:text-charcoal border border-bone px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-xs text-rose-700 mt-3 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
          {error}
        </p>
      )}
    </section>
  );
}
