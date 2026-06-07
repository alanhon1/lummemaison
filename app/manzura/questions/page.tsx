import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import QuestionsClient from '@/components/admin/QuestionsClient';

export const dynamic = 'force-dynamic';

export default async function AdminQuestionsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const admin = createServiceClient();

  const [{ data: unanswered }, { data: faqs }] = await Promise.all([
    admin
      .from('unanswered_questions')
      .select('id, question_text, category, summary, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('faqs')
      .select('id, question, answer, category, active, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return <QuestionsClient unanswered={unanswered ?? []} faqs={faqs ?? []} />;
}
