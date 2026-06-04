import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Mail, MessageCircle, Send, MapPin } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import AnimatedSection from '@/components/layout/AnimatedSection';
import ContactForm from '@/components/contact/ContactForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="pt-24 min-h-screen luxe-bg">
      {/* Hero with ambient glow */}
      <section className="relative bg-obsidian text-cream py-20 px-6 overflow-hidden">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-gold/8 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-gold/5 rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
        <AnimatedSection className="relative max-w-4xl mx-auto text-center" direction="up">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-6">
            B2B Inquiries
          </p>
          <h1 className="font-display text-5xl font-light mb-4">{t('title')}</h1>
          <div className="gold-divider mx-auto mb-4" />
          <p className="text-cream/70">{t('subtitle')}</p>
        </AnimatedSection>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <AnimatedSection direction="left">
            <h2 className="font-display text-2xl font-light mb-8">{t('info.title')}</h2>
            <div className="space-y-6">
              <a
                href={`mailto:${siteConfig.contact.email}`}
                className="flex items-start gap-4 p-5 bg-white border border-bone hover:border-gold transition-colors group"
              >
                <div className="w-10 h-10 border border-bone flex items-center justify-center group-hover:border-gold transition-colors flex-shrink-0">
                  <Mail size={18} className="text-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-mist mb-1">{t('info.email')}</p>
                  <p className="text-sm text-charcoal">{siteConfig.contact.email}</p>
                </div>
              </a>

              {siteConfig.contactChannels.whatsapp && (
                <div className="bg-white border border-bone p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 bg-[#25D366] flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={18} className="text-white" />
                    </div>
                    <p className="text-xs font-semibold tracking-wider uppercase text-mist">{t('info.whatsapp')}</p>
                  </div>
                  <ul className="space-y-2 pl-14">
                    {siteConfig.contact.whatsappNumbers.map(num => (
                      <li key={num}>
                        <a
                          href={`https://wa.me/${num.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-charcoal hover:text-[#25D366] transition-colors"
                        >
                          {num}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {siteConfig.contactChannels.telegram && (
                <div className="bg-white border border-bone p-5">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 bg-[#2AABEE] flex items-center justify-center flex-shrink-0">
                      <Send size={18} className="text-white" />
                    </div>
                    <p className="text-xs font-semibold tracking-wider uppercase text-mist">{t('info.telegram')}</p>
                  </div>
                  <ul className="space-y-2 pl-14">
                    {siteConfig.contact.telegramNumbers.map(num => (
                      <li key={num} className="text-sm text-charcoal">{num}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-start gap-4 p-5 bg-white border border-bone">
                <div className="w-10 h-10 border border-bone flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-mist mb-1">{t('info.address')}</p>
                  <p className="text-sm text-charcoal">{siteConfig.contact.address}</p>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Form */}
          <AnimatedSection direction="right">
            <ContactForm />
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
