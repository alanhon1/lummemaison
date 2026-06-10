import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import QuestionsClient, { type UsageStats } from '@/components/admin/QuestionsClient';

export const dynamic = 'force-dynamic';

// Aggregate per-user chatbot usage from chat_questions. Only users who asked at
// least one question are counted (they're the only ones present in the rows).
function computeUsage(rows: Array<{ user_id: string | null; created_at: string }>): UsageStats {
  const DAY = 86_400_000;
  const now = Date.now();
  const window = (days: number) => {
    const sel = days === 0 ? rows : rows.filter(r => now - new Date(r.created_at).getTime() <= days * DAY);
    const questions = sel.length;
    const users = new Set(sel.map(r => r.user_id)).size;
    return { questions, users, avgPerUser: users ? Math.round((questions / users) * 10) / 10 : 0 };
  };
  const all = window(0);
  return {
    totalQuestions: all.questions,
    totalUsers: all.users,
    avgPerUser: all.avgPerUser,
    windows: [
      { label: 'Per day (last 24h)', ...window(1) },
      { label: 'Per week (last 7d)', ...window(7) },
      { label: 'Per month (last 30d)', ...window(30) },
    ],
  };
}

export default async function AdminQuestionsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const admin = createServiceClient();

  const [{ data: unanswered }, { data: allQuestions }, { data: usageRows }, { data: faqs }] = await Promise.all([
    admin
      .from('unanswered_questions')
      .select('id, question_text, category, summary, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    // chat_questions may not exist until migration 018 is applied → tolerate null.
    admin
      .from('chat_questions')
      .select('id, question_text, category, summary, status, is_fallback, created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('chat_questions')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .limit(10000),
    admin
      .from('faqs')
      .select('id, question, answer, category, active, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const usage = computeUsage((usageRows ?? []) as Array<{ user_id: string | null; created_at: string }>);

  return (
    <QuestionsClient
      unanswered={unanswered ?? []}
      allQuestions={allQuestions ?? []}
      usage={usage}
      faqs={faqs ?? []}
    />
  );
}
