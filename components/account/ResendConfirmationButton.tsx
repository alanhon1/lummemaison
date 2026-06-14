'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { resendConfirmation, type FormState } from '@/app/[locale]/account/actions';

const initial: FormState = {};

/**
 * Shown next to the email on the account page only while the customer is
 * unverified. Reuses the existing resendConfirmation server action (which
 * resends a magic/confirm link and reports success without leaking existence).
 * The parent stops rendering this once email_verified flips true.
 */
export default function ResendConfirmationButton({
  email,
  locale,
}: {
  email: string;
  locale: string;
}) {
  const t = useTranslations('account.dashboard');
  const [state, action, pending] = useActionState(resendConfirmation, initial);

  if (state.success) {
    return <span className="text-[11px] text-emerald-600">{t('confirmationSent')}</span>;
  }

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] text-gold-dark hover:text-gold underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? t('resending') : t('resendConfirmation')}
      </button>
      {state.error && <span className="text-[11px] text-red-600">{state.error}</span>}
    </form>
  );
}
