'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { verifyResetCode, resetPassword, type FormState } from '@/app/[locale]/account/actions';
import { localePath } from '@/lib/i18n';

const initialState: FormState = {};
const inputClass =
  'w-full bg-white border border-bone rounded-md px-3 py-2.5 text-sm text-charcoal outline-none focus:border-gold transition-colors disabled:bg-cream disabled:cursor-not-allowed disabled:text-mist';

// Two server actions back this form:
//   1. verifyResetCode — invoked by the "Check the code" button. On success
//      the UI unlocks the new-password fields and the save button.
//   2. resetPassword — invoked by the final "Save password" button. It
//      re-verifies the code (so a stale UI state can't bypass the check),
//      validates that the two passwords match, and updates the auth.users
//      row via admin.updateUserById, then redirects to login.
//
// The verification step doesn't consume the code (mode: 'check' in the
// action), so a code stays valid across the brief gap between unlock and
// final submit. resetPassword runs the same check in 'consume' mode so the
// code is single-use overall.
export default function ResetPasswordForm() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);

  const [verifyState, verifyAction, verifyPending] = useActionState(verifyResetCode, initialState);
  const [saveState, saveAction, savePending] = useActionState(resetPassword, initialState);

  // useActionState updates synchronously on action resolution; mirror it
  // into local state so the "verified" banner persists alongside the save
  // form's own state.
  if (verifyState.success && !codeVerified) setCodeVerified(true);
  // If the user changes email or code after verifying, lock the password
  // fields again — they'd need to re-verify with the new pair.
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (codeVerified) setCodeVerified(false);
  };
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value);
    if (codeVerified) setCodeVerified(false);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: email + code + check button. */}
      <form action={verifyAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
            {t('resetPassword.emailLabel')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="code" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
            {t('resetPassword.codeLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              autoComplete="one-time-code"
              value={code}
              onChange={handleCodeChange}
              className={`${inputClass} tracking-[0.4em] text-center font-mono`}
              placeholder="0000"
            />
            <button
              type="submit"
              disabled={verifyPending || !email || code.length !== 4}
              className="btn-secondary whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {verifyPending ? t('resetPassword.checking') : t('resetPassword.checkCode')}
            </button>
          </div>
        </div>

        {verifyState.error && !codeVerified && (
          <p className="text-sm text-red-600" role="alert">
            {verifyState.error}
          </p>
        )}
        {codeVerified && (
          <p className="text-sm text-green-800 bg-green-50 border border-green-200 px-3 py-2 rounded-md" role="status">
            {t('resetPassword.codeOk')}
          </p>
        )}
      </form>

      {/* Step 2: new password (locked until code verified). Separate form
          so the verify button never accidentally submits the new password. */}
      <form action={saveAction} className="space-y-4 pt-2 border-t border-bone">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="code" value={code} />

        <div>
          <label htmlFor="password" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
            {t('resetPassword.newPasswordLabel')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={!codeVerified}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-semibold tracking-wider uppercase text-charcoal mb-1.5">
            {t('resetPassword.confirmPasswordLabel')}
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={!codeVerified}
            className={inputClass}
          />
        </div>

        {saveState.error && (
          <p className="text-sm text-red-600" role="alert">
            {saveState.error}
          </p>
        )}

        <button
          type="submit"
          disabled={!codeVerified || savePending}
          className="btn-gold w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {savePending ? t('resetPassword.submitting') : t('resetPassword.submit')}
        </button>
      </form>

      <div className="text-center space-y-2">
        <p className="text-xs">
          <Link href={localePath(locale, '/account/forgot-password')} className="text-gold-dark hover:text-gold underline underline-offset-2">
            {t('resetPassword.needCode')}
          </Link>
        </p>
        <p className="text-xs text-mist">
          <Link href={localePath(locale, '/account/login')} className="text-gold-dark hover:text-gold underline underline-offset-2">
            {t('resetPassword.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
