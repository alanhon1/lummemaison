import type { Metadata, Viewport } from 'next';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  title: { default: 'Lumière Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
  // Phase 3: install /manzura as its own home-screen app, distinct from the
  // customer PWA (own manifest/scope/start_url/icons). Overrides the root.
  manifest: '/manzura.webmanifest',
  appleWebApp: { capable: true, title: 'Lumée Admin', statusBarStyle: 'default' },
  icons: { apple: '/icons/admin-apple-180.png' },
};

export const viewport: Viewport = {
  themeColor: '#3A342C',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans">
      <AdminNav />
      {/* Bottom padding on mobile clears the fixed bottom tab bar. */}
      <div className="pb-20 md:pb-0">{children}</div>
    </div>
  );
}
