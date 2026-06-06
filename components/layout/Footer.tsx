'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { siteConfig } from '@/lib/site-config';
import { localePath } from '@/lib/i18n';
import { MessageCircle, Send, ChevronDown } from 'lucide-react';
import DisclaimerReset from '@/components/disclaimer/DisclaimerReset';

function SectionHeader({ title }: { title: string }) {
  return (
    <summary className="flex items-center justify-between text-xs font-semibold tracking-widest uppercase text-cream mb-3 md:mb-5 cursor-pointer md:cursor-default list-none">
      <span>{title}</span>
      <ChevronDown size={14} className="md:hidden transition-transform group-open:rotate-180" />
    </summary>
  );
}

export default function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const navLinks = [
    { href: localePath(locale), label: tNav('home') },
    { href: localePath(locale, '/catalogue'), label: tNav('catalogue') },
    { href: localePath(locale, '/about'), label: tNav('about') },
    { href: localePath(locale, '/contact'), label: tNav('contact') },
  ];

  return (
    <footer className="bg-charcoal text-cream/80 mt-auto">
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-6 md:pt-16 md:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 mb-8 md:mb-12">
          {/* Brand — always visible */}
          <div className="lg:col-span-1">
            <div className="font-display text-2xl font-light tracking-widest text-cream mb-3">
              Lumée Maison
            </div>
            <p className="text-xs text-cream/50 leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="flex gap-3 mt-6">
              {siteConfig.contactChannels.whatsapp && (
                <a href={siteConfig.social.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors" aria-label="WhatsApp">
                  <MessageCircle size={15} />
                </a>
              )}
              {siteConfig.contactChannels.telegram && (
                <a href={siteConfig.social.telegram} target="_blank" rel="noopener noreferrer"
                  className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors" aria-label="Telegram">
                  <Send size={15} />
                </a>
              )}
            </div>
          </div>

          {/* Navigation */}
          <details open className="footer-collapsible group">
            <SectionHeader title={t('company')} />
            <ul className="space-y-3 pt-2 md:pt-0">
              {navLinks.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-xs text-cream/60 hover:text-gold transition-colors tracking-wide">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          {/* Payment & Shipping */}
          <details open className="footer-collapsible group">
            <SectionHeader title={t('payment')} />
            <ul className="space-y-3 pt-2 md:pt-0">
              <li className="text-xs text-cream/60"><span className="text-gold">Wise</span> — Bank Transfer</li>
              <li className="text-xs text-cream/60"><span className="text-gold">USDT</span> — TRC-20 Network</li>
            </ul>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-cream mb-3 md:mb-5 mt-6 md:mt-8">
              {t('shipping')}
            </h3>
            <ul className="space-y-2">
              <li className="text-xs text-cream/60">
                FedEx with account: <span className="text-gold">${siteConfig.shipping.fedexWithAccount}</span>
              </li>
              <li className="text-xs text-cream/60">
                FedEx without account: <span className="text-gold">${siteConfig.shipping.fedexWithoutAccount}</span>
              </li>
              <li className="text-xs text-cream/50 mt-1">
                {siteConfig.shipping.fedexNote}
              </li>
            </ul>
          </details>

          {/* Contact */}
          <details open className="footer-collapsible group">
            <SectionHeader title="Contact" />
            <ul className="space-y-3 pt-2 md:pt-0">
              <li>
                <a href={`mailto:${siteConfig.contact.email}`} className="text-xs text-cream/60 hover:text-gold transition-colors">
                  {siteConfig.contact.email}
                </a>
              </li>
              {siteConfig.contactChannels.whatsapp && (
                <li>
                  <a href={siteConfig.social.whatsapp} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-cream/60 hover:text-gold transition-colors">
                    WhatsApp: {siteConfig.contact.whatsapp}
                  </a>
                </li>
              )}
              {siteConfig.contactChannels.telegram && (
                <li>
                  <a href={siteConfig.social.telegram} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-cream/60 hover:text-gold transition-colors">
                    Telegram: {siteConfig.contact.telegram}
                  </a>
                </li>
              )}
              {siteConfig.contactChannels.phone && (
                <li>
                  <a href={`tel:${siteConfig.contact.phone}`}
                    className="text-xs text-cream/60 hover:text-gold transition-colors">
                    {siteConfig.contact.phone}
                  </a>
                </li>
              )}
              <li className="text-xs text-cream/50">{siteConfig.contact.address}</li>
            </ul>
          </details>
        </div>

        {/* Bottom */}
        <div className="border-t border-cream/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/40">{t('copyright')}</p>
          <p className="text-xs text-cream/40 text-center">{t('disclaimer')}</p>
          <DisclaimerReset />
        </div>
      </div>
    </footer>
  );
}
