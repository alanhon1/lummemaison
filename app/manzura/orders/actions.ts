'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { formatOrderNumber } from '@/lib/orders/orderNumber';
import { ORDER_STAGES, type OrderStatus } from '@/lib/orders/status';
import { carrierLabel, carrierTrackUrl, isCarrierKey } from '@/lib/orders/carriers';
import { sendShipmentEmail, sendCancellationEmail, sendDeliveryEmail } from '@/lib/email/sendOrderEmails';

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
    .select('order_seq, order_number, customer_name, customer_email, status, carrier, tracking_number, shipped_at, delivered_at, shipment_photo_path')
    .eq('id', orderId)
    .single();
  if (!current) return { ok: false, error: 'order not found' };

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

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  // Best-effort: remove the now-orphaned shipment photo from Storage. We
  // don't care about the result — if it fails the row is already correct;
  // the orphan can be reaped manually later if it matters.
  if (oldPhotoPath) {
    void supabase.storage.from('shipment-photos').remove([oldPhotoPath]);
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
    if (nextStatus === 'cancelled') void sendCancellationEmail(recipient);
    if (nextStatus === 'delivered') void sendDeliveryEmail(recipient);
  }

  revalidatePath(`/manzura/orders/${orderId}`);
  revalidatePath('/manzura/orders');
  revalidatePath('/manzura');
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

  revalidatePath(`/manzura/orders/${orderId}`);
  return { ok: true };
}
