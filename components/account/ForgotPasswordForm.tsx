'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { requestPasswordReset, type FormState } from '@/app/[locale]/account/actions';

const initialState: FormState = {};

export default function ForgotPasswordForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  // After submit, surface a success-shaped CTA pointing to the reset page.
  // We intentionally do NOT reveal whether the email exists — the server
  // returns success in either case, and the copy reflects that ("if the
  // email is on file, a code is on its way").
  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2 rounded-md" role="status">
          {t('forgotPassword.sent')}
        </p>
        <Link href={`/${locale}/account/reset-password`} className="btn-gold w-full inline-flex items-center justify-center">
          {t('forgotPassword.openReset')}
        </Link>
        <p className="text-xs text-mist text-center">
          <Link href={`/${locale}/account/login`} className="text-gold-dark hover:text-gold underline underline-offset-2">
            {t('forgotPassword.backToLogin')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
          {t('forgotPassword.emailLabel')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
        {pending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
      </button>

      <p className="text-xs text-mist text-center">
        <Link href={`/${locale}/account/login`} className="text-gold-dark hover:text-gold underline underline-offset-2">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </form>
  );
}
