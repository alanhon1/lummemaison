import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Shield, Package, Globe, Award } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('title'), description: t('subtitle') };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });

  const values = [
    { icon: Shield, key: 'authentic' as const },
    { icon: Award, key: 'quality' as const },
    { icon: Package, key: 'reliability' as const },
    { icon: Globe, key: 'expertise' as const },
  ];

  return (
    <div className="pt-24 min-h-screen">
      {/* Hero */}
      <section className="bg-obsidian text-cream py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase text-gold mb-6">
            {siteConfig.companyName}
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-light mb-6">{t('title')}</h1>
          <div className="gold-divider mx-auto mb-6" />
          <p className="text-cream/70 text-lg max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <h2 className="font-display text-3xl font-light mb-6">{t('story.title')}</h2>
            <div className="gold-divider mb-6" />
            <p className="text-sm text-charcoal leading-relaxed">{t('story.content')}</p>
          </div>
          <div>
            <h2 className="font-display text-3xl font-light mb-6">{t('mission.title')}</h2>
            <div className="gold-divider mb-6" />
            <p className="text-sm text-charcoal leading-relaxed">{t('mission.content')}</p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 px-6 bg-cream">
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-center mb-4">{t('values.title')}</h2>
          <div className="gold-divider mx-auto mb-16" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {values.map(({ icon: Icon, key }) => (
              <div key={key} className="text-center p-8 bg-white border border-bone">
                <div className="w-12 h-12 border border-gold/30 flex items-center justify-center mx-auto mb-4">
                  <Icon size={20} className="text-gold" />
                </div>
                <h3 className="font-display text-lg font-light">{t(`values.${key}`)}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-24 px-6 bg-obsidian text-cream">
        <div className="max-w-5xl mx-auto">
          <h2 className="section-title text-center text-cream mb-4">{t('process.title')}</h2>
          <div className="gold-divider mx-auto mb-16" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {(['browse', 'request', 'authenticate', 'ship'] as const).map((step, idx) => (
              <div key={step} className="relative">
                <div className="text-xs font-semibold tracking-widest uppercase text-gold mb-3">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <h3 className="font-display text-xl font-light text-cream mb-2">
                  {t(`process.${step}.title`)}
                </h3>
                <p className="text-xs text-cream/60 leading-relaxed">
                  {t(`process.${step}.desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
