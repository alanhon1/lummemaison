import type { Metadata } from 'next';
import { FAQ_ITEMS } from '@/lib/faq-data';
import FaqClient from '@/components/faq/FaqClient';
import OpenChatButton from '@/components/layout/OpenChatButton';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'ru' ? 'Часто задаваемые вопросы | Lumée Maison' : 'FAQ | Lumée Maison',
    description:
      locale === 'ru'
        ? 'Ответы на самые популярные вопросы о доставке, оплате и заказах.'
        : 'Answers to the most common questions about shipping, payment, and orders.',
  };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = locale === 'ru' ? 'ru' : 'en';

  const heading = l === 'ru' ? 'Часто задаваемые вопросы' : 'Frequently Asked Questions';
  const subtitle =
    l === 'ru'
      ? 'Всё, что нужно знать о заказах, доставке и оплате.'
      : 'Everything you need to know about orders, shipping, and payment.';

  return (
    <div className="pt-24 min-h-screen luxe-bg">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-gold mb-3">Support</p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-charcoal mb-4">
            {heading}
          </h1>
          <div className="w-16 h-px bg-gold mx-auto mb-4" />
          <p className="text-sm text-mist">{subtitle}</p>
        </div>

        {/* FAQ list */}
        <FaqClient items={FAQ_ITEMS} locale={l} />

        {/* Still have questions? */}
        <div className="mt-12 text-center border border-bone rounded-2xl p-8 bg-surface">
          <p className="text-sm font-medium text-charcoal mb-1">
            {l === 'ru' ? 'Остались вопросы?' : 'Still have questions?'}
          </p>
          <p className="text-xs text-mist mb-4">
            {l === 'ru'
              ? 'Спросите нашего ассистента или напишите нам напрямую.'
              : 'Ask our assistant, or reach us directly.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <OpenChatButton
              withIcon
              label={l === 'ru' ? 'Спросить ассистента' : 'Chat with our assistant'}
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
