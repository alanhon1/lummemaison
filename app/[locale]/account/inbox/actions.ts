'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';

// Marks the CURRENT signed-in user's unread messages as read. The target user is
// derived from the session, never from a caller-supplied id — server actions are
// publicly invocable, so trusting an argument here would let anyone clear another
// user's unread state by passing their uuid.
export async function markMessagesRead(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const admin = createServiceClient();
  await admin
    .from('user_messages')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
}
