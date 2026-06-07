'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

// Marks a feedback row read (service role bypasses RLS). Fired when the admin
// opens a feedback item in the Feedbacks tab.
export async function markFeedbackRead(
  id: number,
  table: 'feedback' | 'faq_feedback' = 'feedback',
): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from(table).update({ is_read: true }).eq('id', id);
  return { ok: !error };
}
