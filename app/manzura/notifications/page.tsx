import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { getAllProducts } from '@/lib/catalogue';
import NotificationComposer from '@/components/admin/NotificationComposer';
import EnableAdminAlertsButton from '@/components/admin/EnableAdminAlertsButton';

export const dynamic = 'force-dynamic';

interface AdminNotif {
  id: number;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  is_read: boolean;
  created_at: string;
}

export default async function NotificationsPage() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) redirect('/manzura/login');

  const admin = createServiceClient();
  const [{ data: notifData }, products] = await Promise.all([
    admin
      .from('admin_notifications')
      .select('id, kind, title, body, url, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    getAllProducts(),
  ]);

  const notifs = (notifData ?? []) as AdminNotif[];

  // Mark unread as read now that the owner is viewing the inbox (mirrors the
  // customer inbox). Only the rows actually shown on this render are marked —
  // not a blanket is_read=false update — so a notification arriving between the
  // SELECT above and this UPDATE isn't silently marked read unseen.
  const unreadShownIds = notifs.filter(n => !n.is_read).map(n => n.id);
  if (unreadShownIds.length > 0) {
    await admin.from('admin_notifications').update({ is_read: true }).in('id', unreadShownIds);
  }

  const productOptions = products.map(p => ({ id: p.id, name: p.name }));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-24 pb-12 space-y-8">
      <Link href="/manzura" className="inline-flex items-center gap-1 text-sm text-mist hover:text-charcoal">
        ← Dashboard
      </Link>

      <div>
        <h1 className="font-display text-3xl font-light text-charcoal">Notifications</h1>
        <p className="text-xs text-mist mt-1">
          Send a customer notification below, or check incoming order alerts. General news with an
          image goes through the{' '}
          <Link href="/manzura/announcements" className="text-gold hover:underline">Announcements</Link> page.
          {' '}<Link href="/manzura/notifications/diagnostics" className="text-gold hover:underline">Diagnostics</Link>.
        </p>
      </div>

      {/* Composer */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-charcoal">Send to customers</h2>
        <NotificationComposer products={productOptions} />
      </section>

      {/* Admin inbox */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-charcoal">Order alerts</h2>
          <EnableAdminAlertsButton />
        </div>
        {notifs.length === 0 ? (
          <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">
            No notifications yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {notifs.map(n => {
              const cardCls = `block border rounded-sm p-4 ${
                n.is_read ? 'bg-white border-bone' : 'bg-cream border-gold/40'
              }`;
              const inner = (
                <>
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-sm font-semibold text-charcoal">{n.title}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.is_read && (
                        <span className="text-[9px] uppercase tracking-widest bg-gold text-white px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                      <span className="text-[11px] text-mist whitespace-nowrap">
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {n.body && (
                    <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">{n.body}</p>
                  )}
                </>
              );
              return n.url ? (
                <li key={n.id}>
                  <Link href={n.url} className={`${cardCls} hover:border-gold transition-colors`}>
                    {inner}
                  </Link>
                </li>
              ) : (
                <li key={n.id} className={cardCls}>{inner}</li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
