'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { login, type FormState } from '@/app/[locale]/account/actions';

const initialState: FormState = {};

export default function LoginForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '';
  const checkInbox = searchParams.get('checkInbox') === '1';
  const confirmedOk = searchParams.get('confirmed') === '1';
  const confirmError = searchParams.get('confirmError');
  const passwordReset = searchParams.get('passwordReset') === '1';
  const [state, formAction, pending] = useActionState(login, initialState);

  const signUpHref = returnTo
    ? `/${locale}/account/signup?returnTo=${encodeURIComponent(returnTo)}`
    : `/${locale}/account/signup`;
  const forgotHref = `/${locale}/account/forgot-password`;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      {checkInbox && (
        <p className="text-sm text-charcoal bg-gold/10 border border-gold/30 px-3 py-2 rounded-md" role="status">
          {t('login.checkInbox')}
        </p>
      )}
      {confirmedOk && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2 rounded-md" role="status">
          {t('login.confirmed')}
        </p>
      )}
      {passwordReset && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2 rounded-md" role="status">
          {t('login.passwordReset')}
        </p>
      )}
      {confirmError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-md" role="alert">
          {confirmError === 'expired'
            ? t('login.confirmExpired')
            : t('login.confirmInvalid')}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
          {t('fields.email')}
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

      <div>
        <label htmlFor="password" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
          {t('fields.password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors"
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-gold w-full disabled:opacity-60">
        {pending ? t('login.submitting') : t('login.submit')}
      </button>

      <div className="space-y-2 text-center">
        <p className="text-xs">
          <Link href={forgotHref} className="text-gold-dark hover:text-gold underline underline-offset-2">
            {t('login.forgotPassword')}
          </Link>
        </p>
        <p className="text-xs text-mist">
          {t('login.noAccount')}{' '}
          <Link href={signUpHref} className="text-gold-dark hover:text-gold underline underline-offset-2">
            {t('login.signUp')}
          </Link>
        </p>
      </div>
    </form>
  );
}
