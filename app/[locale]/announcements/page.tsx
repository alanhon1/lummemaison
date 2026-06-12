import type { Metadata } from 'next';
import Image from 'next/image';
import { loadActiveAnnouncements } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ru' ? 'Объявления | Lumée Maison' : 'Announcements | Lumée Maison',
    description:
      locale === 'ru'
        ? 'Новости и важные объявления магазина Lumée Maison.'
        : 'News and important announcements from Lumée Maison.',
  };
}

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = locale === 'ru' ? 'ru' : 'en';

  const announcements = await loadActiveAnnouncements();

  const heading = l === 'ru' ? 'Объявления' : 'Announcements';
  const subtitle = l === 'ru' ? 'Новости и обновления магазина.' : 'News and updates from our store.';
  const empty = l === 'ru' ? 'Пока нет объявлений.' : 'No announcements yet.';
  const dateLocale = l === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <div className="pt-24 min-h-screen luxe-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">Lumée Maison</p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-charcoal mb-4">{heading}</h1>
          <div className="w-16 h-px bg-gold mx-auto mb-4" />
          <p className="text-sm text-mist">{subtitle}</p>
        </div>

        {/* Log */}
        {announcements.length === 0 ? (
          <div className="text-center border border-bone rounded-2xl p-8 bg-surface">
            <p className="text-sm text-mist italic">{empty}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.map(a => (
              <article key={a.id} className="border border-bone rounded-2xl p-6 bg-surface">
                <time className="text-xs uppercase tracking-[0.2em] text-gold">
                  {new Date(a.created_at).toLocaleDateString(dateLocale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                <h2 className="font-display text-2xl font-light text-charcoal mt-2 mb-3">{a.title}</h2>
                {a.image_url && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-bone">
                    <Image
                      src={a.image_url}
                      alt={a.title}
                      width={800}
                      height={450}
                      className="w-full h-auto object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <p className="text-sm text-charcoal/80 whitespace-pre-line leading-relaxed">{a.body}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
