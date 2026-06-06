import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import ResetPasswordForm from '@/components/account/ResetPasswordForm';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('resetPassword.pageTitle') };
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(localePath(locale, '/account'));

  const t = await getTranslations({ locale, namespace: 'account' });

  return (
    <main className="min-h-[70vh] flex items-center py-16 px-6 bg-cream">
      <div className="w-full max-w-md mx-auto">
        <h1 className="font-display italic text-3xl md:text-4xl font-light text-charcoal mb-2 text-center">
          {t('resetPassword.title')}
        </h1>
        <p className="text-sm text-mist text-center mb-8">{t('resetPassword.subtitle')}</p>
        <div className="bg-white border border-bone rounded-lg p-6 md:p-8 shadow-sm">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
