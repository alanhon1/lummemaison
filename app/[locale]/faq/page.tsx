import type { Metadata } from 'next';
import { FAQ_ITEMS } from '@/lib/faq-data';
import FaqClient from '@/components/faq/FaqClient';
import OpenChatButton from '@/components/layout/OpenChatButton';

type Locale = 'en' | 'ru' | 'fr' | 'es';

const toLocale = (l: string): Locale =>
  l === 'ru' || l === 'fr' || l === 'es' ? l : 'en';

// Page chrome copy per locale (the FAQ items themselves are localized in
// lib/faq-data.ts). Keep keys in sync across all four locales.
const UI: Record<Locale, {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heading: string;
  subtitle: string;
  stillTitle: string;
  stillBody: string;
  chatLabel: string;
}> = {
  en: {
    metaTitle: 'FAQ | Lumée Maison',
    metaDescription: 'Answers to the most common questions about shipping, payment, and orders.',
    eyebrow: 'Support',
    heading: 'Frequently Asked Questions',
    subtitle: 'Everything you need to know about orders, shipping, and payment.',
    stillTitle: 'Still have questions?',
    stillBody: 'Ask our assistant, or reach us directly.',
    chatLabel: 'Chat with our assistant',
  },
  ru: {
    metaTitle: 'Часто задаваемые вопросы | Lumée Maison',
    metaDescription: 'Ответы на самые популярные вопросы о доставке, оплате и заказах.',
    eyebrow: 'Поддержка',
    heading: 'Часто задаваемые вопросы',
    subtitle: 'Всё, что нужно знать о заказах, доставке и оплате.',
    stillTitle: 'Остались вопросы?',
    stillBody: 'Спросите нашего ассистента или напишите нам напрямую.',
    chatLabel: 'Спросить ассистента',
  },
  fr: {
    metaTitle: 'FAQ | Lumée Maison',
    metaDescription: 'Réponses aux questions les plus fréquentes sur la livraison, le paiement et les commandes.',
    eyebrow: 'Assistance',
    heading: 'Foire aux questions',
    subtitle: 'Tout ce qu\'il faut savoir sur les commandes, la livraison et le paiement.',
    stillTitle: 'Vous avez encore des questions ?',
    stillBody: 'Posez une question à notre assistant ou contactez-nous directement.',
    chatLabel: 'Discuter avec notre assistant',
  },
  es: {
    metaTitle: 'Preguntas frecuentes | Lumée Maison',
    metaDescription: 'Respuestas a las preguntas más frecuentes sobre envíos, pagos y pedidos.',
    eyebrow: 'Soporte',
    heading: 'Preguntas frecuentes',
    subtitle: 'Todo lo que necesita saber sobre pedidos, envíos y pagos.',
    stillTitle: '¿Aún tiene preguntas?',
    stillBody: 'Pregunte a nuestro asistente o contáctenos directamente.',
    chatLabel: 'Chatear con nuestro asistente',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ui = UI[toLocale(locale)];
  return { title: ui.metaTitle, description: ui.metaDescription };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = toLocale(locale);
  const ui = UI[l];

  return (
    <div className="pt-24 min-h-screen luxe-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">{ui.eyebrow}</p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-charcoal mb-4">
            {ui.heading}
          </h1>
          <div className="w-16 h-px bg-gold mx-auto mb-4" />
          <p className="text-sm text-mist">{ui.subtitle}</p>
        </div>

        {/* FAQ list */}
        <FaqClient items={FAQ_ITEMS} locale={l} />

        {/* Still have questions? */}
        <div className="mt-12 text-center border border-bone rounded-2xl p-8 bg-surface">
          <p className="text-sm font-medium text-charcoal mb-1">{ui.stillTitle}</p>
          <p className="text-xs text-mist mb-4">{ui.stillBody}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <OpenChatButton
              withIcon
              label={ui.chatLabel}
              className="inline-flex items-center gap-2 text-xs px-5 py-2.5 rounded-full bg-gold text-white hover:bg-gold-dark transition-colors"
            />
            <a
              href="mailto:info@lumeemaison.com"
              className="inline-block text-xs px-5 py-2.5 rounded-full bg-charcoal text-cream hover:bg-obsidian transition-colors"
            >
              info@lumeemaison.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
