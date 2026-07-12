'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { pushToUser } from '@/lib/push/notify';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { stageIndex, type OrderStatus } from '@/lib/orders/status';
import { carrierLabel, carrierTrackUrl, isCarrierKey } from '@/lib/orders/carriers';
import { sendShipmentEmail, sendCancellationEmail, sendDeliveryEmail, sendPaymentVerifiedEmail, sendLowStockAlert, sendPaymentOpenEmail, type QuoteEmailData } from '@/lib/email/sendOrderEmails';
import { findCountry } from '@/lib/countries';
import { deductStockForItems, restoreStockForItems, getStockFlagsMap, stockKey } from '@/lib/products/stock';
import { sendOrderToOpsHub, sendStatusToOpsHub } from '@/lib/ops/ingest';

const SHIPMENT_BUCKET = 'shipment-photos';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ----- updateOrderStatus -----
// Generic single-field status flip. Use for non-shipped transitions (the
// shipped one needs carrier/tracking/photo — see markOrderShipped below).
//
// Allowed transitions: any forward stage, plus rollback by one, plus cancel/reopen.
const VALID_STATUSES = new Set<OrderStatus>([
  'quote_pending',
  'awaiting_payment',
  'order_received',
  'payment_verified',
  'packaging',
  'shipped',
  'delivered',
  'cancelled',
]);

export async function updateOrderStatus(
  orderId: number,
  nextStatus: OrderStatus,
  // When the packaging crossing is blocked by insufficient stock, passing
  // { autoAddStock: true } tops every short line up to the ordered quantity and
  // records it in stock history as reason 'auto_add' (the admin's 2nd click).
  options?: { autoAddStock?: boolean },
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'not authorized' };
  }
  if (!VALID_STATUSES.has(nextStatus)) {
    return { ok: false, error: `invalid status: ${nextStatus}` };
  }

  const supabase = createServiceClient();

  // Snapshot the row first. We need it for: (a) cancellation email, (b)
  // detecting rollbacks past `shipped` so the patch can clear stale shipment
  // metadata (carrier / tracking / photo / shipped_at), and (c) validating a
  // delivered → shipped rollback (allowed only when the shipment metadata is
  // still intact). One read either way.
  const { data: current } = await supabase
    .from('orders')
    .select('order_seq, order_number, customer_name, customer_email, status, carrier, tracking_number, shipped_at, delivered_at, shipment_photo_path, subtotal_cents, shipping_cents, total_cents, currency, created_at, shipping_address')
    .eq('id', orderId)
    .single();
  if (!current) return { ok: false, error: 'order not found' };

  // Guard: quote_pending orders must go through openOrderPayment() first.
  // The only valid exits are awaiting_payment (via Open payment) and cancelled.
  if (current.status === 'quote_pending' && !['awaiting_payment', 'cancelled'].includes(nextStatus)) {
    return { ok: false, error: 'Set shipping and Open payment first.' };
  }

  if (nextStatus === 'shipped') {
    // A *fresh* ship (capturing carrier + tracking + photo) must go through
    // markOrderShipped. The only valid path here is a single-step rollback
    // from `delivered` back to `shipped`, where that metadata already exists
    // and is preserved untouched.
    const canRollbackToShipped =
      current.status === 'delivered' &&
      !!current.carrier &&
      !!current.tracking_number &&
      !!current.shipment_photo_path;
    if (!canRollbackToShipped) {
      return { ok: false, error: 'use markOrderShipped() to transition to shipped' };
    }
  }

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'delivered') patch.delivered_at = new Date().toISOString();

  // Rollback hygiene: if the row used to be at `shipped` / `delivered` and
  // we're moving back to a stage *before* shipped, scrub the shipment metadata
  // so the customer-side detail page doesn't show stale tracking info next to
  // a stepper that has un-stepped past shipped. A delivered → shipped rollback
  // keeps the metadata (nextStatus === 'shipped' is excluded here).
  const wasShippedOrLater = current.status === 'shipped' || current.status === 'delivered';
  const rollingBackPastShipped =
    wasShippedOrLater && nextStatus !== 'delivered' && nextStatus !== 'shipped';
  const oldPhotoPath = rollingBackPastShipped ? (current.shipment_photo_path as string | null) : null;
  if (rollingBackPastShipped) {
    patch.carrier = null;
    patch.tracking_number = null;
    patch.shipment_photo_path = null;
    patch.shipped_at = null;
  }
  // Same idea for delivered_at if we ever leave `delivered`.
  if (current.status === 'delivered' && nextStatus !== 'delivered') {
    patch.delivered_at = null;
  }

  // Stock is deducted when the order first reaches PACKING (not at
  // payment_verified) — inventory only leaves the shelf once fulfilment starts.
  // Until then, payment-verified orders surface on the "Items in Orders" page as
  // what still needs to be procured. NEVER for test orders (order_number
  // "TEST-..."), so they never touch real inventory.
  const isTestOrder = String(current.order_number ?? '').toUpperCase().startsWith('TEST-');
  const PACK_IDX = stageIndex('packaging');

  // Items snapshot for the "payment verified" customer email + the ops-hub
  // ingest push (no stock change).
  let verifiedItems: Array<{ product_id: number; product_name: string; unit_cents: number; quantity: number; option: string | null }> | null = null;
  if (nextStatus === 'payment_verified' && current.status !== 'payment_verified' && !isTestOrder) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, unit_cents, quantity, option')
      .eq('order_id', orderId);
    verifiedItems = (items as Array<{ product_id: number; product_name: string; unit_cents: number; quantity: number; option: string | null }> | null) ?? null;
  }

  // Deduct on the FORWARD crossing into packaging-or-beyond (threshold-crossing,
  // so a packing↔shipped rollback never re-deducts and a jump past packaging
  // still deducts once).
  if (!isTestOrder && stageIndex(current.status) < PACK_IDX && stageIndex(nextStatus) >= PACK_IDX) {
    const { data: items } = await supabase
      .from('order_items')
      .select('product_id, product_name, unit_cents, quantity, option')
      .eq('order_id', orderId);
    if (items && items.length > 0) {
      const lines = (items as Array<{ product_id: number; product_name: string; unit_cents: number; quantity: number; option: string | null }>)
        .map(i => ({ ...i, option: i.option ?? '' }));
      // Idempotency: if this order already recorded an 'order' deduction, a prior
      // attempt deducted stock but failed before the status write below — don't
      // deduct again on retry (which previously drove stock down by 2x).
      const { data: priorOrderMov } = await supabase
        .from('stock_movements').select('id').eq('order_id', orderId).eq('reason', 'order').limit(1);
      if ((priorOrderMov?.length ?? 0) === 0) {
      // Oversell guard, per (product_id, option): an order may have been placed
      // for more than we hold (oversell is allowed). Stock must never go
      // negative, so block the packaging crossing until every option is covered.
      // Checked BEFORE deduction so nothing is taken on a failed pack.
      const flags = await getStockFlagsMap(lines.map(i => ({ product_id: i.product_id, option: i.option })));
      const stockOf = (i: { product_id: number; option: string }) => flags[stockKey(i.product_id, i.option)]?.stock ?? 0;
      const short = lines.filter(i => stockOf(i) < i.quantity);
      if (short.length > 0) {
        if (!options?.autoAddStock) {
          const detail = short
            .map(i => `${i.product_name}${i.option ? ` (${i.option})` : ''} (stock ${stockOf(i)} / ordered ${i.quantity}, short by ${i.quantity - stockOf(i)})`)
            .join(', ');
          return {
            ok: false,
            error: `Can't move to packaging — not enough stock. Restock and try again: ${detail}`,
          };
        }
        // Auto-add: top each short line up to the ordered quantity so packing can
        // proceed, and record the added amount in stock history as 'auto_add'.
        // Receiving a real number also clears the arbitrarily-assigned (S) flag.
        for (const i of short) {
          const shortfall = i.quantity - stockOf(i);
          const { error: addErr } = await supabase
            .from('product_stock')
            .upsert(
              { product_id: i.product_id, option: i.option, stock: i.quantity, wonder: false, stock_unknown: false },
              { onConflict: 'product_id,option' },
            );
          if (addErr) return { ok: false, error: `Auto-add stock failed: ${addErr.message}` };
          const { error: addMovErr } = await supabase.from('stock_movements').insert({
            product_id: i.product_id, option: i.option, delta: shortfall, reason: 'auto_add', order_id: orderId,
          });
          if (addMovErr) console.error('[stock] auto_add movement insert failed:', addMovErr.message);
        }
      }
      const deductResult = await deductStockForItems(lines.map(i => ({ product_id: i.product_id, quantity: i.quantity, option: i.option })));
      if (!deductResult.ok) {
        return { ok: false, error: `Stock deduction failed: ${deductResult.error}` };
      }
      const { error: orderMovErr } = await supabase.from('stock_movements').insert(
        lines.map(i => ({ product_id: i.product_id, option: i.option, delta: -i.quantity, reason: 'order', order_id: orderId })),
      );
      if (orderMovErr) console.error('[stock] order movement insert failed:', orderMovErr.message);
      // Low stock alert: options at/below threshold after deduction.
      const LOW = 2;
      const flagsAfter = await getStockFlagsMap(lines.map(i => ({ product_id: i.product_id, option: i.option })));
      const lowItems = lines
        .filter(i => (flagsAfter[stockKey(i.product_id, i.option)]?.stock ?? 0) <= LOW)
        .map(i => ({ id: i.product_id, name: `${i.product_name}${i.option ? ` (${i.option})` : ''}`, stock: flagsAfter[stockKey(i.product_id, i.option)]?.stock ?? 0 }));
      if (lowItems.length > 0) void sendLowStockAlert({ products: lowItems });
      } // end !alreadyDeducted
    }
  }

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  // Best-effort: remove the now-orphaned shipment photo from Storage. We
  // don't care about the result — if it fails the row is already correct;
  // the orphan can be reaped manually later if it matters.
  if (oldPhotoPath) {
    void supabase.storage.from('shipment-photos').remove([oldPhotoPath]);
  }

  // On cancel: restore stock and relabel history movements as 'cancelled'.
  // Awaited (not fire-and-forget) — on serverless, an un-awaited promise after
  // the response can be frozen/killed before it finishes, which left stock
  // unrestored and the history movements still tagged 'order' (showing -n
  // instead of the cancelled/0 row).
  if (nextStatus === 'cancelled' && current.status !== 'cancelled') {
    const wasStockDeducted = !isTestOrder && stageIndex(current.status) >= stageIndex('packaging');
    if (wasStockDeducted) {
      try {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, quantity, option')
          .eq('order_id', orderId);
        if (items && items.length > 0) {
          const typed = (items as Array<{ product_id: number; quantity: number; option: string | null }>)
            .map(i => ({ product_id: i.product_id, quantity: i.quantity, option: i.option ?? '' }));
          await restoreStockForItems(typed);
          // Mark the original deduction rows as 'cancelled' (greyed in History)…
          await supabase
            .from('stock_movements')
            .update({ reason: 'cancelled' })
            .eq('order_id', orderId)
            .eq('reason', 'order');
          // …and add an explicit +n restock row per item so History shows the
          // −n / +n pair (which nets to 0) rather than a single ambiguous row.
          await supabase.from('stock_movements').insert(
            typed.map(it => ({
              product_id: it.product_id,
              option: it.option,
              delta: it.quantity,
              reason: 'cancel_restock',
              order_id: orderId,
            })),
          );
        }
      } catch (e) {
        // Best-effort: don't fail the status update if stock ops error — but LOG
        // it, since a silent failure leaves stock un-restored (phantom oversell).
        console.error('[stock] cancel restock failed for order', orderId, e);
      }
    }
  }

  // Rollback past packing: restore stock and relabel history movements as 'cancelled'.
  if (nextStatus !== 'cancelled' && current.status !== nextStatus) {
    const currentIdx = stageIndex(current.status);
    const nextIdx = stageIndex(nextStatus);
    const packIdx = stageIndex('packaging');
    if (!isTestOrder && currentIdx >= packIdx && nextIdx < packIdx) {
      try {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, quantity, option')
          .eq('order_id', orderId);
        if (items && items.length > 0) {
          const typed = (items as Array<{ product_id: number; quantity: number; option: string | null }>)
            .map(i => ({ product_id: i.product_id, quantity: i.quantity, option: i.option ?? '' }));
          await restoreStockForItems(typed);
          // Mark the original deduction rows as 'cancelled' (greyed in History)…
          await supabase
            .from('stock_movements')
            .update({ reason: 'cancelled' })
            .eq('order_id', orderId)
            .eq('reason', 'order');
          // …and add an explicit +n restock row per item so History shows the
          // −n / +n pair (which nets to 0) rather than a single ambiguous row.
          await supabase.from('stock_movements').insert(
            typed.map(it => ({
              product_id: it.product_id,
              option: it.option,
              delta: it.quantity,
              reason: 'cancel_restock',
              order_id: orderId,
            })),
          );
        }
      } catch (e) {
        // Best-effort, but log: a silent failure leaves stock un-restored.
        console.error('[stock] rollback restock failed for order', orderId, e);
      }
    }
  }

  // Fire-and-forget customer notifications keyed to the new status. Never
  // blocks the action; failures land in Vercel logs only. The send paths
  // themselves are no-ops if the row was already at this status because we
  // gate the send on the PREVIOUS status differing — that's why
  // `current.status !== nextStatus` here.
  if (current.status !== nextStatus) {
    const orderNumber =
      current.order_seq != null ? formatOrderNumber(current.order_seq as number) : (current.order_number as string);
    const recipient = {
      orderNumber,
      customerName: current.customer_name as string,
      customerEmail: current.customer_email as string,
    };
    // Awaited (not fire-and-forget): an un-awaited promise after the action
    // returns can be frozen/killed on serverless before the mail is sent, so a
    // status-change email could silently never go out. The senders catch their
    // own errors, so awaiting never throws here.
    if (nextStatus === 'cancelled') await sendCancellationEmail(recipient);
    if (nextStatus === 'delivered') await sendDeliveryEmail(recipient);
    if (nextStatus === 'payment_verified' && verifiedItems) {
      await sendPaymentVerifiedEmail({
        ...recipient,
        items: verifiedItems.map(i => ({ name: i.product_name, quantity: i.quantity, price: i.unit_cents })),
        subtotalCents: (current.subtotal_cents as number) ?? 0,
        shippingCents: (current.shipping_cents as number) ?? 0,
        totalCents: (current.total_cents as number) ?? 0,
        currency: (current.currency as string) ?? 'USD',
      });

      // Push the now-paid order to the internal ops hub (packing + accounting).
      // Awaited but never throws; the hub dedupes by order number, so verifying
      // again after a rollback won't create a duplicate over there.
      const addr = (current.shipping_address ?? {}) as {
        street?: string; city?: string; state_province?: string; postal_code?: string; country?: string;
      };
      const countryName = addr.country ? findCountry(addr.country)?.name ?? addr.country : '';
      await sendOrderToOpsHub({
        external_order_id: orderNumber,
        order_date: (current.created_at as string) ?? new Date().toISOString(),
        customer_name: (current.customer_name as string) ?? '',
        customer_country: countryName,
        shipping_address: [addr.street, addr.city, addr.state_province, addr.postal_code, countryName]
          .filter(Boolean)
          .join(', '),
        currency: (current.currency as string) ?? 'USD',
        total_paid: ((current.total_cents as number) ?? 0) / 100,
        items: verifiedItems.map(i => ({
          sku: String(i.product_id),
          product_name: i.option ? `${i.product_name} (${i.option})` : i.product_name,
          qty: i.quantity,
        })),
      });
    }
  }

  // Mirror packing/cancel onto the ops hub so its board matches this side
  // (shipped goes through markOrderShipped below). Awaited, never throws.
  if (!isTestOrder && current.status !== nextStatus) {
    const hubStatus =
      nextStatus === 'packaging' ? 'packing' : nextStatus === 'cancelled' ? 'cancelled' : null;
    if (hubStatus) {
      const orderNumber =
        current.order_seq != null ? formatOrderNumber(current.order_seq as number) : (current.order_number as string);
      await sendStatusToOpsHub({ external_order_id: orderNumber, status: hubStatus });
    }
  }

  revalidatePath(`/manzura/orders/${orderId}`);
  revalidatePath('/manzura/orders');
  revalidatePath('/manzura');
  revalidatePath('/manzura/stock');
  return { ok: true };
}

// ----- markOrderShipped -----
// Reads carrier (text key) + tracking_number + a photo File from FormData.
// Uploads the photo to the private `shipment-photos` bucket, then updates the
// order row in one shot. Fires the customer ship-notification email after the
// DB write succeeds; email failure is logged but never rolls back the ship.
export async function markOrderShipped(formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'not authorized' };
  }

  const orderIdRaw = formData.get('orderId');
  const orderId = Number.parseInt(String(orderIdRaw ?? ''), 10);
  if (!Number.isFinite(orderId)) return { ok: false, error: 'missing orderId' };

  const carrier = String(formData.get('carrier') ?? '').trim();
  const trackingNumber = String(formData.get('trackingNumber') ?? '').trim();
  const photo = formData.get('photo');
  if (!isCarrierKey(carrier)) return { ok: false, error: 'invalid carrier' };
  if (!trackingNumber) return { ok: false, error: 'tracking number required' };
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, error: 'shipment photo required' };
  }

  const supabase = createServiceClient();

  // Resolve order ahead of time so we can use its order_seq + customer email
  // in the post-update notification step.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_seq, order_number, customer_name, customer_email')
    .eq('id', orderId)
    .single();
  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? 'order not found' };
  }

  // Upload the photo. Path layout: <orderId>/<uuid>.<ext>.
  const ext = (photo.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${orderId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from(SHIPMENT_BUCKET)
    .upload(path, buffer, {
      contentType: photo.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadErr) return { ok: false, error: `photo upload failed: ${uploadErr.message}` };

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      status: 'shipped',
      carrier,
      tracking_number: trackingNumber,
      shipment_photo_path: path,
      shipped_at: new Date().toISOString(),
    })
    .eq('id', orderId);
  if (updateErr) {
    // Best-effort cleanup of the uploaded photo if the DB write failed.
    await supabase.storage.from(SHIPMENT_BUCKET).remove([path]);
    return { ok: false, error: updateErr.message };
  }

  // Fire-and-forget shipment notification — never fails the action.
  const orderNumber =
    order.order_seq != null ? formatOrderNumber(order.order_seq) : order.order_number;
  const trackingUrl = carrierTrackUrl(carrier, trackingNumber) ?? undefined;
  void sendShipmentEmail({
    orderNumber,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    carrierLabel: carrierLabel(carrier),
    trackingNumber,
    trackingUrl,
  });

  // Mirror onto the ops hub (board + stock follow; awaited, never throws).
  if (!orderNumber.toUpperCase().startsWith('TEST-')) {
    await sendStatusToOpsHub({
      external_order_id: orderNumber,
      status: 'shipped',
      tracking_number: trackingNumber,
      carrier: carrierLabel(carrier),
    });
  }

  revalidatePath(`/manzura/orders/${orderId}`);
  revalidatePath('/manzura/orders');
  revalidatePath('/manzura');
  return { ok: true };
}

// ----- addOrderMessage -----
// Insert into order_messages. Always sender_role='admin' in v1 — customer
// writes are not yet wired up (per the spec's v1.1 scope deferral).
export async function addOrderMessage(
  orderId: number,
  body: string,
  isInternal: boolean,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'not authorized' };
  }
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) return { ok: false, error: 'message body is empty' };

  const supabase = createServiceClient();
  const { error } = await supabase.from('order_messages').insert({
    order_id: orderId,
    sender_role: 'admin',
    body: trimmed,
    is_internal: isInternal,
  });
  if (error) return { ok: false, error: error.message };

  // Customer-visible messages also fire a Web Push to the order owner's devices
  // (banner + badge), not just the in-app order thread. Internal admin notes
  // never notify the customer. Best-effort — never blocks the saved message.
  if (!isInternal) {
    const { data: ord } = await supabase
      .from('orders')
      .select('user_id, order_seq')
      .eq('id', orderId)
      .maybeSingle();
    if (ord?.user_id) {
      await pushToUser(ord.user_id as string, {
        title: 'New message about your order',
        body: trimmed.slice(0, 300),
        url: ord.order_seq != null ? `/account/orders/${ord.order_seq}` : '/account',
        count: 1,
      });
    }
  }

  revalidatePath(`/manzura/orders/${orderId}`);
  return { ok: true };
}

// ----- deleteOrder -----
// Permanently removes a CANCELLED order and all its child records (items,
// messages, stock-movement history) plus any shipment photo. Guarded to
// cancelled orders only — an active order must be cancelled first.
export async function deleteOrder(orderId: number): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'not authorized' };
  }

  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from('orders')
    .select('status, shipment_photo_path')
    .eq('id', orderId)
    .single();
  if (!order) return { ok: false, error: 'order not found' };
  if (order.status !== 'cancelled') {
    return { ok: false, error: 'only cancelled orders can be deleted' };
  }

  // Remove child rows first so we don't depend on FK cascade being configured.
  await supabase.from('stock_movements').delete().eq('order_id', orderId);
  await supabase.from('order_messages').delete().eq('order_id', orderId);
  await supabase.from('order_items').delete().eq('order_id', orderId);

  // Best-effort: drop the now-orphaned shipment photo from Storage.
  if (order.shipment_photo_path) {
    void supabase.storage.from(SHIPMENT_BUCKET).remove([order.shipment_photo_path as string]);
  }

  const { error } = await supabase.from('orders').delete().eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/manzura/orders');
  revalidatePath('/manzura');
  revalidatePath('/manzura/stock');
  return { ok: true };
}

// ----- openOrderPayment -----
// Sets real shipping, computes new total, moves status to `awaiting_payment`,
// and emails the customer to pay. Only valid from `quote_pending`.
export async function openOrderPayment(orderId: number, shippingCents: number): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }
  if (!Number.isFinite(shippingCents) || shippingCents < 0) {
    return { ok: false, error: 'Invalid shipping amount' };
  }

  const supabase = createServiceClient();
  const { data: o } = await supabase
    .from('orders')
    .select('id, status, subtotal_cents, total_cents, order_seq, order_number, customer_name, customer_email, shipping_address')
    .eq('id', orderId)
    .single();
  if (!o) return { ok: false, error: 'order not found' };
  if (o.status !== 'quote_pending') return { ok: false, error: 'Order is not awaiting a quote.' };

  // discount = subtotal − current_total (current total has shipping 0, so this is the 15% off)
  const subtotalCents = o.subtotal_cents as number;
  const currentTotal = o.total_cents as number;
  const discount = subtotalCents - currentTotal;
  const newTotal = currentTotal + Math.round(shippingCents);

  const { error: updateErr } = await supabase
    .from('orders')
    .update({ shipping_cents: Math.round(shippingCents), total_cents: newTotal, status: 'awaiting_payment' })
    .eq('id', orderId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Fire-and-forget payment-open email to the customer. Never throws.
  try {
    const addr = o.shipping_address as {
      street: string; city: string; state_province?: string | null; postal_code: string; country: string;
    };
    const orderNumber =
      o.order_seq != null ? formatOrderNumber(o.order_seq as number) : (o.order_number as string);
    const emailData: QuoteEmailData = {
      orderNumber,
      orderSeq: (o.order_seq as number) ?? 0,
      customerName: o.customer_name as string,
      customerEmail: o.customer_email as string,
      shippingAddress: {
        street: addr.street,
        city: addr.city,
        state_province: addr.state_province ?? undefined,
        postal_code: addr.postal_code,
        country: addr.country,
        countryName: findCountry(addr.country)?.name ?? addr.country,
      },
      subtotalCents,
      discountCents: discount,
      totalCents: newTotal,
    };
    await sendPaymentOpenEmail(emailData);
  } catch (e) {
    // Email failure is non-fatal; log and continue.
    console.error('[openOrderPayment] payment-open email threw:', e);
  }

  revalidatePath(`/manzura/orders/${orderId}`);
  revalidatePath('/manzura/orders');
  revalidatePath('/manzura');
  return { ok: true };
}
