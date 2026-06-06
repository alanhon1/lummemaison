import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import { markMessagesRead } from './actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface Message {
  id: number;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'inbox' });
  return { title: t('title') };
}

export default async function InboxPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(localePath(locale, '/account/login'));

  const t = await getTranslations({ locale, namespace: 'inbox' });

  const { data, error } = await supabase
    .from('user_messages')
    .select('id, subject, body, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-12">
        <Link href={`/${locale}`} className="inline-flex items-center gap-1 text-sm text-mist hover:text-charcoal py-2 pr-6">
          ← Back to Home
        </Link>
        <h1 className="font-display text-3xl font-light text-charcoal mt-6 mb-2">{t('title')}</h1>
        <p className="text-sm text-red-600 mt-4">Failed to load inbox.</p>
      </div>
    );
  }

  const messages = (data ?? []) as Message[];
  const hasUnread = messages.some(m => !m.is_read);

  // Mark all unread as read now that the user is viewing the inbox
  if (hasUnread) {
    await markMessagesRead(user.id);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-28 pb-12 space-y-6">
      <Link href={`/${locale}`} className="inline-flex items-center gap-1 text-sm text-mist hover:text-charcoal py-2 pr-6">
        ← Back to Home
      </Link>

      <div>
        <h1 className="font-display text-3xl font-light text-charcoal">{t('title')}</h1>
        <p className="text-xs text-mist mt-1">{t('subtitle')}</p>
      </div>

      {messages.length === 0 ? (
        <p className="text-sm text-mist border border-dashed border-bone p-8 text-center">
          {t('noMessages')}
        </p>
      ) : (
        <ul className="space-y-4">
          {messages.map(m => (
            <li
              key={m.id}
              className={`border rounded-sm p-5 ${
                m.is_read && !hasUnread ? 'bg-white border-bone' : 'bg-cream border-gold/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold text-charcoal">{m.subject}</p>
                  <p className="text-[11px] text-mist">{t('from')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(!m.is_read || hasUnread) && (
                    <span className="text-[9px] uppercase tracking-widest bg-gold text-white px-2 py-0.5 rounded-full">
                      {t('unread')}
                    </span>
                  )}
                  <span className="text-[11px] text-mist whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
