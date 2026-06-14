'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { restoreStockForItems } from '@/lib/products/stock';
import { stageIndex } from '@/lib/orders/status';
import { sendCancellationEmail } from '@/lib/email/sendOrderEmails';
import { formatOrderNumber } from '@/lib/orders/orderNumber';

// Mark all messages on the given order as "seen" by the current user.
// Called from the order detail page's <MessagesSeenMarker> on mount, so
// the unread badge on the dashboard list disappears once the customer
// has actually opened the detail page.
//
// Uses the service-role client to perform the UPDATE (the orders table
// has a "own orders read" RLS policy but no own-write policy — writes
// to orders are intentionally server-side only). The explicit
// .eq('user_id', user.id) prevents the action from updating anyone
// else's row even with the elevated client.
const CANCELLABLE_STATUSES = new Set(['order_received', 'payment_verified', 'packaging']);

export async function cancelOrder(orderId: number): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!Number.isFinite(orderId)) return { ok: false, error: 'Invalid order.' };

  const admin = createServiceClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, order_seq, order_number, status, user_id, customer_name, customer_email')
    .eq('id', orderId)
    .single();

  if (!order || order.user_id !== user.id) return { ok: false, error: 'Order not found.' };
  if (!CANCELLABLE_STATUSES.has(order.status as string)) {
    return { ok: false, error: 'This order can no longer be cancelled.' };
  }

  const { error } = await admin.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  // Restore stock + log movements — but ONLY if stock was actually deducted,
  // which now happens at the packing stage (not payment_verified). Cancelling a
  // not-yet-packed order must not add phantom stock. Awaited (not fire-and-
  // forget) — on serverless an un-awaited promise after the response can be
  // killed before it finishes, leaving stock unrestored and history wrong.
  // Test orders (order_number "TEST-…") never deducted real stock, so cancelling
  // one must not restore any — that would inject phantom inventory.
  const isTestOrder = String(order.order_number ?? '').toUpperCase().startsWith('TEST-');
  const wasStockDeducted = !isTestOrder && stageIndex(order.status as string) >= stageIndex('packaging');
  try {
    const { data: items } = wasStockDeducted
      ? await admin.from('order_items').select('product_id, quantity').eq('order_id', orderId)
      : { data: null };
    if (items && items.length > 0) {
      const typed = items as Array<{ product_id: number; quantity: number }>;
      await restoreStockForItems(typed);
      // Mark the original deduction rows as 'cancelled' (greyed in History)…
      await admin
        .from('stock_movements')
        .update({ reason: 'cancelled' })
        .eq('order_id', orderId)
        .eq('reason', 'order');
      // …and add an explicit +n restock row per item so History shows the
      // −n / +n pair (which nets to 0) rather than a single ambiguous row.
      await admin.from('stock_movements').insert(
        typed.map(it => ({
          product_id: it.product_id,
          delta: it.quantity,
          reason: 'cancel_restock',
          order_id: orderId,
        })),
      );
    }
  } catch {
    // Best-effort: stock_movements table may not exist yet (migration 013 not applied).
  }

  const orderNumber =
    order.order_seq != null
      ? formatOrderNumber(order.order_seq as number)
      : (order.order_number as string);
  void sendCancellationEmail({
    orderNumber,
    customerName: order.customer_name as string,
    customerEmail: order.customer_email as string,
  });

  revalidatePath(`/account/orders/${order.order_seq ?? order.order_number}`);
  revalidatePath('/account');
  return { ok: true };
}

export async function markMessagesSeen(orderId: number): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!Number.isFinite(orderId)) return { ok: false };

  const admin = createServiceClient();
  const { error } = await admin
    .from('orders')
    .update({ last_message_seen_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('user_id', user.id);
  return { ok: !error };
}

// ----- Order photo attachments (#8) -----
const ATTACH_BUCKET = 'order-attachments';
const MAX_ATTACHMENTS = 3;
const MAX_COMMENT = 50;

// Customer attaches one photo (+ optional ≤50-char comment) to their own order.
// Up to MAX_ATTACHMENTS total; one at a time.
export async function addOrderAttachment(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const orderId = Number.parseInt(String(formData.get('orderId') ?? ''), 10);
  if (!Number.isFinite(orderId)) return { ok: false, error: 'Invalid order.' };

  const admin = createServiceClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, order_seq, order_number')
    .eq('id', orderId)
    .single();
  if (!order || order.user_id !== user.id) return { ok: false, error: 'Order not found.' };

  const { count } = await admin
    .from('order_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if ((count ?? 0) >= MAX_ATTACHMENTS) {
    return { ok: false, error: `You can attach up to ${MAX_ATTACHMENTS} photos.` };
  }

  const photo = formData.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: 'Please choose a photo.' };
  if (photo.size > 10 * 1024 * 1024) return { ok: false, error: 'Photo is too large (max 10MB).' };
  const comment = String(formData.get('comment') ?? '').trim().slice(0, MAX_COMMENT);

  const ext = (photo.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${orderId}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await photo.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(ATTACH_BUCKET)
    .upload(path, buffer, { contentType: photo.type || 'application/octet-stream', upsert: false });
  if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };

  const { error: insErr } = await admin
    .from('order_attachments')
    .insert({ order_id: orderId, storage_path: path, comment: comment || null });
  if (insErr) {
    await admin.storage.from(ATTACH_BUCKET).remove([path]); // best-effort cleanup
    return { ok: false, error: insErr.message };
  }

  revalidatePath(`/account/orders/${order.order_seq ?? order.order_number}`);
  return { ok: true };
}

// Customer removes one of their own order attachments.
export async function deleteOrderAttachment(attachmentId: number): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };
  if (!Number.isFinite(attachmentId)) return { ok: false, error: 'Invalid attachment.' };

  const admin = createServiceClient();
  const { data: att } = await admin
    .from('order_attachments')
    .select('id, storage_path, order_id')
    .eq('id', attachmentId)
    .single();
  if (!att) return { ok: false, error: 'Attachment not found.' };

  const { data: order } = await admin
    .from('orders')
    .select('user_id, order_seq, order_number')
    .eq('id', att.order_id)
    .single();
  if (!order || order.user_id !== user.id) return { ok: false, error: 'Not allowed.' };

  await admin.storage.from(ATTACH_BUCKET).remove([att.storage_path as string]);
  await admin.from('order_attachments').delete().eq('id', attachmentId);

  revalidatePath(`/account/orders/${order.order_seq ?? order.order_number}`);
  return { ok: true };
}
