'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { login, type FormState } from '@/app/[locale]/account/actions';

const initialState: FormState = {};

export default function LoginForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />

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

      <p className="text-xs text-mist text-center">
        {t('login.noAccount')}{' '}
        <Link href={`/${locale}/account/signup`} className="text-gold-dark hover:text-gold underline underline-offset-2">
          {t('login.signUp')}
        </Link>
      </p>
    </form>
  );
}
