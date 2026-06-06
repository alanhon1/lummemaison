import type { Metadata } from 'next';
import AdminNav from '@/components/admin/AdminNav';

export const metadata: Metadata = {
  title: { default: 'Lumière Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
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
