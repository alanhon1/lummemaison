'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

export async function markHandled(ids: number[]): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin
    .from('unanswered_questions')
    .update({ status: 'handled' })
    .in('id', ids);
  return { ok: !error };
}

export async function createFaq(
  unansweredIds: number[],
  question: string,
  answer: string,
  category: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'not authorized' };
  }
  const admin = createServiceClient();

  const { error: insertErr } = await admin.from('faqs').insert({
    question: question.trim(),
    answer: answer.trim(),
    category,
    active: true,
    unanswered_id: unansweredIds[0] ?? null,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  await admin
    .from('unanswered_questions')
    .update({ status: 'handled' })
    .in('id', unansweredIds);

  return { ok: true };
}

export async function deleteFaq(id: number): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from('faqs').delete().eq('id', id);
  return { ok: !error };
}

export async function toggleFaq(id: number, active: boolean): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from('faqs').update({ active }).eq('id', id);
  return { ok: !error };
}

export async function deleteQuestions(ids: number[]): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from('unanswered_questions').delete().in('id', ids);
  return { ok: !error };
}

export async function updateQuestionText(id: number, text: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin
    .from('unanswered_questions')
    .update({ question_text: text.trim().slice(0, 1000) })
    .eq('id', id);
  return { ok: !error };
}
