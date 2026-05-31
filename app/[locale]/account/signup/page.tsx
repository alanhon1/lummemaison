import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import SignupForm from '@/components/account/SignupForm';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('signup.pageTitle') };
}

export default async function SignupPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/${locale}/account`);

  const t = await getTranslations({ locale, namespace: 'account' });

  return (
    <main className="min-h-[70vh] py-16 px-6 bg-cream">
      <div className="w-full max-w-2xl mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl font-light text-charcoal mb-2 text-center">
          {t('signup.title')}
        </h1>
        <p className="text-sm text-mist text-center mb-8">{t('signup.subtitle')}</p>
        <div className="bg-white border border-bone rounded-lg p-6 md:p-8 shadow-sm">
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
