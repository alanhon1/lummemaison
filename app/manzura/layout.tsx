import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Lumière Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream font-sans">
      {children}
    </div>
  );
}
