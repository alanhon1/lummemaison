import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CheckoutEntryPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/checkout/shipping`);
}
