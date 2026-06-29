import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import PushDiagPanel from '@/components/admin/PushDiagPanel';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-12 space-y-6">
      <Link href="/manzura" className="inline-flex items-center gap-1 text-sm text-mist hover:text-charcoal">
        ← Dashboard
      </Link>
      <div>
        <h1 className="font-display text-3xl font-light text-charcoal">Notifications</h1>
        <p className="text-xs text-mist mt-1">
          Customer push is sent from the <Link href="/manzura/announcements" className="text-gold hover:underline">Announcements</Link> page
          (tick &ldquo;Also push to subscribed customers&rdquo; when creating one). Diagnostics below.
        </p>
      </div>
      <PushDiagPanel />
    </div>
  );
}
