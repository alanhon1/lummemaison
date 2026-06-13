'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

// Marks a reported-issue row read (service role bypasses RLS). Fired when the
// admin opens an issue in the Issues tab.
export async function markIssueRead(id: number): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from('reported_issues').update({ is_read: true }).eq('id', id);
  return { ok: !error };
}

// Permanently deletes a reported-issue row once the admin has dealt with it.
export async function deleteIssue(id: number): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from('reported_issues').delete().eq('id', id);
  return { ok: !error };
}
