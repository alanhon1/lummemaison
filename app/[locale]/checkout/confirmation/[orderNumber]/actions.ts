'use server';

import { createClient } from '@/lib/supabase/server';

export type FeedbackResult = { ok: boolean; id?: number; error?: string };

// Step 2 of the feedback flow: the 👍/👎 click captures the rating immediately,
// even if the customer never writes a comment. Idempotent — one feedback per
// order; a repeat click returns the existing row. Ownership of the order is
// verified so a user can't attach feedback to someone else's order.
export async function submitRating(orderId: number, rating: 'up' | 'down'): Promise<FeedbackResult> {
  if (rating !== 'up' && rating !== 'down') return { ok: false, error: 'Invalid rating.' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  // Order must belong to the signed-in user (orders RLS already filters, but be
  // explicit so a forged order_id is rejected rather than silently inserted).
  const { data: order } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'Order not found.' };

  const { data: existing } = await supabase
    .from('feedback')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();
  if (existing) return { ok: true, id: existing.id as number };

  const { data, error } = await supabase
    .from('feedback')
    .insert({ order_id: orderId, user_id: user.id, rating })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as number };
}

// Step 4: attach the optional comment to the row created in step 2.
export async function attachComment(feedbackId: number, comment: string): Promise<FeedbackResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const clean = comment.trim().slice(0, 2000);
  const { error } = await supabase
    .from('feedback')
    .update({ comment: clean || null })
    .eq('id', feedbackId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: feedbackId };
}
