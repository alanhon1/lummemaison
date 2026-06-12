import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, localePath } from '@/lib/i18n';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartPanel from '@/components/layout/CartPanel';
import FloatingWhatsApp from '@/components/layout/FloatingWhatsApp';
import ChatWidget from '@/components/layout/ChatWidget';
import GoldParticles from '@/components/effects/GoldParticles';
import { createClient } from '@/lib/supabase/server';
import DisclaimerModal from '@/components/disclaimer/DisclaimerModal';
import AnnouncementModal from '@/components/announcements/AnnouncementModal';
import { loadActiveAnnouncements } from '@/lib/announcements';
import type { Metadata } from 'next';

export function generateStaticParams() {
  return locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: localePath(locale),
      languages: { en: '/', ru: '/ru' },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const announcements = await loadActiveAnnouncements();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div lang={locale} className="flex flex-col min-h-screen">
        <GoldParticles />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartPanel />
        <FloatingWhatsApp />
        <ChatWidget isLoggedIn={!!user} />
        <DisclaimerModal />
        <AnnouncementModal announcements={announcements} />
      </div>
    </NextIntlClientProvider>
  );
}
