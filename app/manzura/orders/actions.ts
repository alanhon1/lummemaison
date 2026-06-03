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
import { sendShipmentEmail, sendCancellationEmail } from '@/lib/email/sendOrderEmails';

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
  if (nextStatus === 'shipped') {
    // Shipped requires carrier + tracking + photo — caller must use
    // markOrderShipped instead. Refuse here to keep that invariant explicit.
    return { ok: false, error: 'use markOrderShipped() to transition to shipped' };
  }

  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === 'delivered') patch.delivered_at = new Date().toISOString();

  // Fetch the order ahead of the update so the cancellation email has the
  // customer name + display order number to use. Cheap — single row read.
  let snapshot: { order_seq: number | null; order_number: string; customer_name: string; customer_email: string } | null = null;
  if (nextStatus === 'cancelled') {
    const { data } = await supabase
      .from('orders')
      .select('order_seq, order_number, customer_name, customer_email')
      .eq('id', orderId)
      .single();
    snapshot = data ?? null;
  }

  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  // Fire-and-forget customer cancellation notification. Never blocks the action.
  if (nextStatus === 'cancelled' && snapshot) {
    const orderNumber =
      snapshot.order_seq != null ? formatOrderNumber(snapshot.order_seq) : snapshot.order_number;
    void sendCancellationEmail({
      orderNumber,
      customerName: snapshot.customer_name,
      customerEmail: snapshot.customer_email,
    });
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
