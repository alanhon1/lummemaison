'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { restoreStockForItems } from '@/lib/products/stock';
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

  // Best-effort: restore stock + log movements.
  void (async () => {
    try {
      const { data: items } = await admin
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);
      if (items && items.length > 0) {
        const typed = items as Array<{ product_id: number; quantity: number }>;
        await restoreStockForItems(typed);
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
      // Silent: stock_movements table may not exist yet (migration 013 not applied).
    }
  })();

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
