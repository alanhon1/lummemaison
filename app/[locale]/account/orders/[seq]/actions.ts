'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';

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
