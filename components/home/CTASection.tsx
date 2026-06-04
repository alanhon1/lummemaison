'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageCircle, Send, Mail } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

export default function CTASection() {
  const t = useTranslations('home.cta');
  const locale = useLocale();

  return (
    <section className="py-12 md:py-28 bg-transparent overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent" />
      <div className="max-w-4xl mx-auto px-6 text-center relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="gold-divider mx-auto mb-8" />
          <h2 className="section-title mb-4">{t('title')}</h2>
          <p className="text-sm text-mist mb-10 max-w-lg mx-auto leading-relaxed">
            {t('subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-3 sm:gap-4">
            <a
              href={siteConfig.social.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp w-full sm:w-auto"
            >
              <MessageCircle size={16} />
              {t('whatsapp')}
            </a>
            <a
              href={siteConfig.social.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-telegram w-full sm:w-auto"
            >
              <Send size={16} />
              {t('telegram')}
            </a>
            <Link
              href={`/${locale}/contact`}
              className="btn-gold w-full sm:w-auto gap-2"
            >
              <Mail size={16} />
              {t('email')}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
