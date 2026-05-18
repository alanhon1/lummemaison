import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Mail, MessageCircle, Send, MapPin } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';
import AnimatedSection from '@/components/layout/AnimatedSection';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="pt-24 min-h-screen bg-cream">
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

              <a
                href={siteConfig.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 p-5 bg-white border border-bone hover:border-[#25D366] transition-colors group"
              >
                <div className="w-10 h-10 bg-[#25D366] flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-mist mb-1">{t('info.whatsapp')}</p>
                  <p className="text-sm text-charcoal">{siteConfig.contact.whatsapp}</p>
                </div>
              </a>

              <a
                href={siteConfig.social.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 p-5 bg-white border border-bone hover:border-[#2AABEE] transition-colors group"
              >
                <div className="w-10 h-10 bg-[#2AABEE] flex items-center justify-center flex-shrink-0">
                  <Send size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-mist mb-1">{t('info.telegram')}</p>
                  <p className="text-sm text-charcoal">{siteConfig.contact.telegram}</p>
                </div>
              </a>

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
            <h2 className="font-display text-2xl font-light mb-8">Send a Message</h2>
            <form className="space-y-4" action={siteConfig.social.whatsapp}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                    {t('form.name')}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white"
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                    {t('form.email')}
                  </label>
                  <input
                    type="email"
                    className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                  {t('form.company')}
                </label>
                <input
                  type="text"
                  className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white"
                  placeholder="Clinic / Company Name"
                />
              </div>
              <div>
                <label className="text-xs font-semibold tracking-wider uppercase text-mist block mb-2">
                  {t('form.message')}
                </label>
                <textarea
                  rows={5}
                  className="w-full border border-bone px-4 py-3 text-sm text-charcoal outline-none focus:border-gold transition-colors bg-white resize-none"
                  placeholder="Tell us about your requirements..."
                />
              </div>
              <p className="text-xs text-mist">
                * For fastest response, contact us directly via WhatsApp or Telegram
              </p>
              <a
                href={siteConfig.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full text-center block"
              >
                {t('form.send')} via WhatsApp
              </a>
            </form>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
