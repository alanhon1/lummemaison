'use server';

import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

// The question lists live in two tables: unanswered_questions (fallback triage)
// and chat_questions (every question — the "All questions" view). Actions take
// an optional source so one set of handlers serves both. Allow-listed to avoid
// any client-supplied table name reaching the query.
export type QuestionSource = 'unanswered_questions' | 'chat_questions';
function table(source?: string): QuestionSource {
  return source === 'chat_questions' ? 'chat_questions' : 'unanswered_questions';
}

export async function markHandled(ids: number[], source?: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin
    .from(table(source))
    .update({ status: 'handled' })
    .in('id', ids);
  return { ok: !error };
}

export async function createFaq(
  questionIds: number[],
  question: string,
  answer: string,
  category: string,
  source?: string,
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
    // faqs.unanswered_id FKs unanswered_questions — only set it for that source.
    unanswered_id: table(source) === 'unanswered_questions' ? (questionIds[0] ?? null) : null,
  });
  if (insertErr) return { ok: false, error: insertErr.message };

  await admin
    .from(table(source))
    .update({ status: 'handled' })
    .in('id', questionIds);

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

export async function deleteQuestions(ids: number[], source?: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin.from(table(source)).delete().in('id', ids);
  return { ok: !error };
}

export async function updateQuestionText(id: number, text: string, source?: string): Promise<{ ok: boolean }> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false };
  }
  const admin = createServiceClient();
  const { error } = await admin
    .from(table(source))
    .update({ question_text: text.trim().slice(0, 1000) })
    .eq('id', id);
  return { ok: !error };
}
