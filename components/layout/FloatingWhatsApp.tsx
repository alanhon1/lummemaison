'use client';

import { MessageCircle } from 'lucide-react';
import { siteConfig } from '@/lib/site-config';

export default function FloatingWhatsApp() {
  return (
    <a
      href={siteConfig.social.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-30 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#20bd5a] transition-all duration-300 hover:scale-110"
      aria-label="Contact via WhatsApp"
    >
      <MessageCircle size={24} fill="currentColor" />
    </a>
  );
}
