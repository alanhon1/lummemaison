'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

export default function FloatingWhatsApp() {
  const pathname = usePathname();
  const isProductPage = /\/product\/\d+/.test(pathname);
  const visibilityClass = isProductPage ? 'hidden md:flex' : 'flex';

  return (
    <a
      href={siteConfig.social.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className={`${visibilityClass} fixed bottom-6 right-6 z-30 w-14 h-14 bg-[#25D366] text-white rounded-full items-center justify-center shadow-lg hover:bg-[#20bd5a] transition-all duration-300 hover:scale-110`}
      aria-label="Contact via WhatsApp"
    >
      <MessageCircle size={24} fill="currentColor" />
    </a>
  );
}
