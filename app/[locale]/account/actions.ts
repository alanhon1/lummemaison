'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { localePath } from '@/lib/i18n';
import {
  sendSignupConfirmationEmail,
  sendPasswordResetCodeEmail,
} from '@/lib/email/sendOrderEmails';
import { missingEmailEnv } from '@/lib/email/mailer';

export type FormState = { error?: string; success?: boolean };

// Resolves the public-facing absolute origin (https://lumeemaison.com,
// http://localhost:3000, etc.) so we can build the redirect_to URL that
// Supabase will send the customer back to after they click the
// confirmation link. Prefers NEXT_PUBLIC_SITE_URL (set in .env), falls
// back to the request's host header for local dev / preview builds.
async function getOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

export interface SignupInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  fedexAccount: string;
  locale: string;
}

function readSignupInput(formData: FormData): SignupInput {
  return {
    fullName: String(formData.get('fullName') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
    phone: String(formData.get('phone') ?? '').trim(),
    country: String(formData.get('country') ?? '').trim(),
    street: String(formData.get('street') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    stateProvince: String(formData.get('stateProvince') ?? '').trim(),
    postalCode: String(formData.get('postalCode') ?? '').trim(),
    fedexAccount: String(formData.get('fedexAccount') ?? '').trim(),
    locale: String(formData.get('locale') ?? 'en'),
  };
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const input = readSignupInput(formData);

  if (
    !input.fullName ||
    !input.email ||
    !input.password ||
    !input.phone ||
    !input.country ||
    !input.street ||
    !input.city ||
    !input.postalCode
  ) {
    return { error: 'Please fill in every required field.' };
  }
  if (input.password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  // Two-step flow so the customer must confirm their email before they can
  // sign in:
  //
  //   1. admin.generateLink({ type: 'signup' }) — creates the auth.users row
  //      (unconfirmed) and returns an action_link we can mail ourselves.
  //      Synchronous, so the FK to customer_profiles is guaranteed valid by
  //      the time we INSERT (this was the race that previously surfaced as
  //      "customer_profiles_user_id_fkey" errors on anon.signUp).
  //   2. sendSignupConfirmationEmail() — sends the action_link via our own
  //      Nodemailer (lib/email/mailer.ts) instead of Supabase's internal
  //      SMTP, which is rate-limited at 3/hour on the free tier and was
  //      blocking real signups in production.
  //
  // When the customer clicks the link, Supabase verifies the token and
  // redirects to /<locale>/account/login?confirmed=1, where the LoginForm
  // surfaces a success banner.
  const admin = createServiceClient();
  const origin = await getOrigin();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
    },
  });
  if (linkError) return { error: linkError.message };
  const user = linkData.user;
  const hashedToken = linkData.properties?.hashed_token;
  if (!user || !hashedToken) return { error: 'Unable to create account. Please try again.' };

  // Don't use linkData.properties.action_link — that's a Supabase-hosted URL
  // and the verify+redirect dance over there can't set auth cookies on OUR
  // domain. Instead build a URL to our own /auth/confirm route handler, which
  // calls supabase.auth.verifyOtp on the SSR client so cookies land on
  // lumeemaison.com. After verification we redirect into /[locale]/account.
  const nextPath = `${localePath(input.locale, '/account')}?welcome=1`;
  const confirmUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=email&next=${encodeURIComponent(nextPath)}`;

  const { error: profileError } = await admin.from('customer_profiles').insert({
    user_id: user.id,
    full_name: input.fullName,
    phone: input.phone,
    country: input.country,
    street: input.street,
    city: input.city,
    state_province: input.stateProvince || null,
    postal_code: input.postalCode,
    fedex_account: input.country === 'US' ? input.fedexAccount || null : null,
  });
  if (profileError) {
    // Roll back the auth user so the customer can retry with the same email
    // (e.g. if they hit a transient validation failure on the profile row).
    await admin.auth.admin.deleteUser(user.id);
    return { error: profileError.message };
  }

  // Send the confirmation email. If the mailer is misconfigured the user
  // still exists with their profile — surfacing the error here lets them
  // retry without having to re-enter the whole form (and without orphaning
  // the auth row, which would block them from retrying with the same email).
  const sendResult = await sendSignupConfirmationEmail({
    customerName: input.fullName,
    customerEmail: input.email,
    confirmUrl,
  });
  if (!sendResult.ok) {
    // Log the precise cause server-side (including which env vars are missing,
    // the usual culprit in production) but show the customer a friendly,
    // non-technical message — "SMTP_FROM missing" means nothing to them.
    const missing = missingEmailEnv();
    console.error(
      '[signup] confirmation email failed for',
      input.email,
      '— reason:',
      sendResult.error ?? 'unknown',
      missing.length ? `— missing env: ${missing.join(', ')}` : '',
    );
    return {
      error:
        "Your account was created, but we couldn't send the confirmation email right now. Please contact support and we'll confirm your account.",
    };
  }

  // Redirect to login with a banner — the customer must confirm before they
  // can sign in. Preserve returnTo so we still land them where they intended
  // to go (e.g. checkout) once they're authenticated.
  const returnTo = String(formData.get('returnTo') ?? '');
  const params = new URLSearchParams({ checkInbox: '1' });
  if (returnTo) params.set('returnTo', returnTo);
  redirect(`${localePath(input.locale, '/account/login')}?${params.toString()}`);
}

function safeReturnTo(value: string, locale: string): string {
  // Same-origin relative paths only (single leading slash) to prevent open
  // redirects. English has no locale prefix now, so we can't key on
  // `/${locale}/`. Falls back to the account page.
  if (value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return localePath(locale, '/account');
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const locale = String(formData.get('locale') ?? 'en');
  const returnTo = String(formData.get('returnTo') ?? '');

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // GoTrue checks email-confirmation BEFORE password — so an unconfirmed
    // user gets "Email not confirmed" regardless of whether the password is
    // right or wrong. Surface a dedicated message so the customer knows to
    // check their inbox instead of thinking they've mistyped the password.
    const code = (error as { code?: string }).code;
    const msg = error.message?.toLowerCase() ?? '';
    if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
      return {
        error: 'Your email is not confirmed yet. Please check your inbox for the confirmation link before signing in.',
      };
    }
    return { error: error.message };
  }
  redirect(returnTo ? safeReturnTo(returnTo, locale) : localePath(locale, '/account'));
}

// ---------------------------------------------------------------------------
// Password reset — 4-digit OTP flow.
//
// requestPasswordReset emails a one-time 4-digit code to the customer.
// verifyResetCode confirms a code without consuming it (so the UI can
// enable the password fields). resetPassword performs the final password
// update and clears the code row.
//
// Security:
//   - 4 digits = 10,000 possibilities; we cap at 5 wrong attempts per row
//     and expire the row after 10 minutes (whichever comes first).
//   - We never reveal whether an email exists — requestPasswordReset
//     returns success even for unknown emails so attackers can't enumerate.
//   - Codes live in public.password_reset_codes; all reads/writes go via
//     the service-role client.
// ---------------------------------------------------------------------------

const RESET_CODE_TTL_MINUTES = 10;
const RESET_CODE_MAX_ATTEMPTS = 5;

function generateFourDigitCode(): string {
  // Cryptographically random in [0, 10000); zero-pad to 4 digits.
  // crypto.randomInt is sync — fine in a server action.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const n = require('crypto').randomInt(0, 10000) as number;
  return String(n).padStart(4, '0');
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  // Supabase JS doesn't expose getUserByEmail directly, so we walk listUsers.
  // For a wholesale catalogue with O(hundreds) of users this is fine; if the
  // table grows past a few thousand consider an RPC instead.
  const admin = createServiceClient();
  let page = 1;
  // perPage caps at 1000 server-side. Loop until we run out of results.
  // (Hard cap at 10 pages = 10k users to avoid runaway loops.)
  for (let i = 0; i < 10; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found && found.email) return { id: found.id, email: found.email };
    if (data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Please enter your email.' };

  const user = await findUserByEmail(email);
  // Always return success — never reveal whether the email exists.
  if (!user) return { success: true };

  const code = generateFourDigitCode();
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000).toISOString();
  const admin = createServiceClient();
  const { error: upsertError } = await admin
    .from('password_reset_codes')
    .upsert({ user_id: user.id, code, expires_at: expiresAt, attempts: 0 }, { onConflict: 'user_id' });
  if (upsertError) {
    console.error('[password-reset] upsert failed', upsertError.message);
    // Still return success to avoid enumeration; logs surface the issue.
    return { success: true };
  }

  await sendPasswordResetCodeEmail({
    customerEmail: user.email,
    code,
    ttlMinutes: RESET_CODE_TTL_MINUTES,
  });
  return { success: true };
}

interface ResetCodeRow {
  user_id: string;
  code: string;
  expires_at: string;
  attempts: number;
}

// Returns the row only if the code matches AND the row is still valid
// (not expired, attempts under limit). Increments attempts on mismatch.
async function consumeOrCheckResetCode(
  email: string,
  code: string,
  mode: 'check' | 'consume',
): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, error: 'Invalid email or code.' };

  const admin = createServiceClient();
  const { data: row, error: fetchError } = await admin
    .from('password_reset_codes')
    .select('user_id, code, expires_at, attempts')
    .eq('user_id', user.id)
    .maybeSingle<ResetCodeRow>();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: 'No active reset code. Please request a new one.' };

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'Reset code expired. Please request a new one.' };
  }
  if (row.attempts >= RESET_CODE_MAX_ATTEMPTS) {
    return { ok: false, error: 'Too many wrong attempts. Please request a new code.' };
  }

  if (row.code !== code.trim()) {
    await admin
      .from('password_reset_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('user_id', user.id);
    return { ok: false, error: 'Incorrect code.' };
  }

  if (mode === 'consume') {
    // Delete the row so the code can't be reused.
    await admin.from('password_reset_codes').delete().eq('user_id', user.id);
  }
  return { ok: true, user_id: user.id };
}

export async function verifyResetCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  if (!email || !code) return { error: 'Email and code are required.' };
  if (!/^\d{4}$/.test(code)) return { error: 'Code must be 4 digits.' };

  const result = await consumeOrCheckResetCode(email, code, 'check');
  if (!result.ok) return { error: result.error };
  return { success: true };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');
  const locale = String(formData.get('locale') ?? 'en');

  if (!email || !code || !password || !confirmPassword) {
    return { error: 'Please fill in every field.' };
  }
  if (!/^\d{4}$/.test(code)) return { error: 'Code must be 4 digits.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirmPassword) return { error: 'Passwords do not match.' };

  const result = await consumeOrCheckResetCode(email, code, 'consume');
  if (!result.ok) return { error: result.error };

  const admin = createServiceClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(result.user_id, { password });
  if (updateError) return { error: updateError.message };

  // Send them back to login. Banner shows "Password updated, please sign in".
  redirect(`${localePath(locale, '/account/login')}?passwordReset=1`);
}

export async function logout(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(localePath(locale));
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  fedexAccount: string;
}

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const input: ProfileUpdateInput = {
    fullName: String(formData.get('fullName') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    country: String(formData.get('country') ?? '').trim(),
    street: String(formData.get('street') ?? '').trim(),
    city: String(formData.get('city') ?? '').trim(),
    stateProvince: String(formData.get('stateProvince') ?? '').trim(),
    postalCode: String(formData.get('postalCode') ?? '').trim(),
    fedexAccount: String(formData.get('fedexAccount') ?? '').trim(),
  };

  if (
    !input.fullName ||
    !input.phone ||
    !input.country ||
    !input.street ||
    !input.city ||
    !input.postalCode
  ) {
    return { error: 'Please fill in every required field.' };
  }

  const { error } = await supabase
    .from('customer_profiles')
    .update({
      full_name: input.fullName,
      phone: input.phone,
      country: input.country,
      street: input.street,
      city: input.city,
      state_province: input.stateProvince || null,
      postal_code: input.postalCode,
      fedex_account: input.country === 'US' ? input.fedexAccount || null : null,
    })
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/[locale]/account', 'page');
  return { success: true };
}
