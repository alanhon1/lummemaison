import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import IssuesClient, { type IssueRow } from '@/components/admin/IssuesClient';

export const dynamic = 'force-dynamic';

export default async function AdminIssuesPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const admin = createServiceClient();
  const { data, error } = await admin
    .from('reported_issues')
    .select('id, message, contact_email, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-light text-charcoal mb-4">Reported issues</h1>
        <p className="text-sm text-red-600">Failed to load reported issues: {error.message}</p>
      </div>
    );
  }

  const rows: IssueRow[] = (data ?? []).map(r => ({
    id: r.id as number,
    message: (r.message as string) ?? '',
    contact_email: (r.contact_email as string | null) ?? null,
    is_read: (r.is_read as boolean) ?? false,
    created_at: r.created_at as string,
  }));

  return <IssuesClient rows={rows} />;
}
