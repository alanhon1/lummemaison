import type { Metadata } from 'next';
import Image from 'next/image';
import { loadActiveAnnouncements } from '@/lib/announcements';

export const dynamic = 'force-dynamic';

type Loc = 'en' | 'ru' | 'fr' | 'es';
const toLoc = (l: string): Loc => (l === 'ru' || l === 'fr' || l === 'es' ? l : 'en');

const UI: Record<Loc, { metaTitle: string; metaDescription: string; heading: string; subtitle: string; empty: string; dateLocale: string }> = {
  en: { metaTitle: 'Announcements | Lumée Maison', metaDescription: 'News and important announcements from Lumée Maison.', heading: 'Announcements', subtitle: 'News and updates from our store.', empty: 'No announcements yet.', dateLocale: 'en-US' },
  ru: { metaTitle: 'Объявления | Lumée Maison', metaDescription: 'Новости и важные объявления магазина Lumée Maison.', heading: 'Объявления', subtitle: 'Новости и обновления магазина.', empty: 'Пока нет объявлений.', dateLocale: 'ru-RU' },
  fr: { metaTitle: 'Actualités | Lumée Maison', metaDescription: 'Actualités et annonces importantes de Lumée Maison.', heading: 'Actualités', subtitle: 'Actualités et nouveautés de notre boutique.', empty: 'Aucune annonce pour le moment.', dateLocale: 'fr-FR' },
  es: { metaTitle: 'Novedades | Lumée Maison', metaDescription: 'Novedades y anuncios importantes de Lumée Maison.', heading: 'Novedades', subtitle: 'Novedades y actualizaciones de nuestra tienda.', empty: 'Aún no hay anuncios.', dateLocale: 'es-ES' },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ui = UI[toLoc(locale)];
  return { title: ui.metaTitle, description: ui.metaDescription };
}

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const ui = UI[toLoc(locale)];

  const announcements = await loadActiveAnnouncements();

  const heading = ui.heading;
  const subtitle = ui.subtitle;
  const empty = ui.empty;
  const dateLocale = ui.dateLocale;

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
