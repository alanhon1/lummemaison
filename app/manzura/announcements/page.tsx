import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import AnnouncementsClient from '@/components/admin/AnnouncementsClient';
import type { Announcement } from '@/lib/announcements';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  return <AnnouncementsClient items={(data ?? []) as Announcement[]} />;
}
