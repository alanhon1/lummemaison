'use server';

import { createServiceClient } from '@/lib/supabase/server';

export async function markMessagesRead(userId: string): Promise<void> {
  const admin = createServiceClient();
  await admin
    .from('user_messages')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}
