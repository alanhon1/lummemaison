'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('Unauthorized');
}

export async function sendMessage(
  userId: string,
  _prevState: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();

  const subject = (formData.get('subject') as string | null)?.trim() ?? '';
  const body = (formData.get('body') as string | null)?.trim() ?? '';

  if (!subject || !body) return { error: 'Subject and message are required.' };
  if (subject.length > 200) return { error: 'Subject is too long (max 200 characters).' };

  const admin = createServiceClient();
  const { error } = await admin.from('user_messages').insert({ user_id: userId, subject, body });

  if (error) {
    if (error.message.includes('user_messages')) {
      return { error: 'Apply migration 012_user_messages.sql in Supabase first.' };
    }
    return { error: error.message };
  }

  return { ok: true };
}
