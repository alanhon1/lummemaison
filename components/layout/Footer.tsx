import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { siteConfig } from '@/lib/site-config';
import { Share2, Link2, MessageCircle, Send, Download } from 'lucide-react';

export default function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  return (
    <footer className="bg-charcoal text-cream/80 mt-auto">
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="font-display text-2xl font-light tracking-widest text-cream mb-3">
              Lumière
            </div>
            <p className="text-xs text-cream/60 leading-relaxed mb-4">
              {siteConfig.companyName}<br />
              ({siteConfig.companyNameAlt})
            </p>
            <p className="text-xs text-cream/50 leading-relaxed">
              {siteConfig.description}
            </p>
            <div className="flex gap-3 mt-6">
              <a
                href={siteConfig.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors"
                aria-label="Instagram"
              >
                <Share2 size={15} />
              </a>
              <a
                href={siteConfig.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors"
                aria-label="Facebook"
              >
                <Link2 size={15} />
              </a>
              <a
                href={siteConfig.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors"
                aria-label="WhatsApp"
              >
                <MessageCircle size={15} />
              </a>
              <a
                href={siteConfig.social.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-cream/20 text-cream/60 hover:text-gold hover:border-gold transition-colors"
                aria-label="Telegram"
              >
                <Send size={15} />
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-cream mb-5">
              {t('company')}
            </h3>
            <ul className="space-y-3">
              {[
                { href: `/${locale}`, label: tNav('home') },
                { href: `/${locale}/catalogue`, label: tNav('catalogue') },
                { href: `/${locale}/about`, label: tNav('about') },
                { href: `/${locale}/contact`, label: tNav('contact') },
              ].map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-xs text-cream/60 hover:text-gold transition-colors tracking-wide"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Payment & Shipping */}
          <div>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-cream mb-5">
              {t('payment')}
            </h3>
            <ul className="space-y-3">
              <li className="text-xs text-cream/60">
                <span className="text-gold">Wise</span> — Bank Transfer
              </li>
              <li className="text-xs text-cream/60">
                <span className="text-gold">USDT</span> — TRC-20 Network
              </li>
            </ul>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-cream mb-5 mt-8">
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
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-semibold tracking-widest uppercase text-cream mb-5">
              Contact
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="text-xs text-cream/60 hover:text-gold transition-colors"
                >
                  {siteConfig.contact.email}
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.social.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cream/60 hover:text-gold transition-colors"
                >
                  WhatsApp: {siteConfig.contact.whatsapp}
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.social.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cream/60 hover:text-gold transition-colors"
                >
                  Telegram: {siteConfig.contact.telegram}
                </a>
              </li>
              <li className="text-xs text-cream/50">
                {siteConfig.contact.address}
              </li>
            </ul>

            <a
              href={siteConfig.catalogue.pdfUrl}
              download
              className="mt-6 inline-flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-gold border border-gold px-3 py-2 hover:bg-gold hover:text-white transition-colors"
            >
              <Download size={13} />
              {t('downloadCatalogue')}
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-cream/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-cream/40">{t('copyright')}</p>
          <p className="text-xs text-cream/40 text-center">{t('disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}
