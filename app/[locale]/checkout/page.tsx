import { redirect } from 'next/navigation';
import { localePath } from '@/lib/i18n';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CheckoutEntryPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(localePath(locale, '/checkout/shipping'));
}
