import { Metadata } from 'next';
import AdminClient from '@/components/admin/AdminClient';

export const metadata: Metadata = {
  title: 'Admin — Lumière',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
