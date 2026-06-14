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

  // Email confirmation is OPTIONAL (see migration 024_email_optional). We create
  // the account already confirmed in Supabase so the customer can sign in
  // immediately — a failed confirmation email must never lock them out of a
  // store they're trying to buy from. Whether they actually verify their address
  // is tracked separately in customer_profiles.email_verified (flipped to true
  // in /auth/confirm), which powers the admin "Email not confirmed" badge.
  //
  // admin.createUser is synchronous and returns the user, so the FK from
  // customer_profiles -> auth.users is valid by the time we INSERT (this was the
  // race that previously surfaced as "customer_profiles_user_id_fkey" errors on
  // anon.signUp). It sends no email of its own.
  const admin = createServiceClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (createError || !created?.user) {
    return { error: createError?.message ?? 'Unable to create account. Please try again.' };
  }
  const user = created.user;

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

  // Fire the confirmation/verify email but DON'T block signup on it. The account
  // already works; a delivery failure just leaves email_verified=false, which the
  // team sees via the admin badge. The link is a magic link that both signs them
  // in and flips email_verified to true on /auth/confirm.
  try {
    const origin = await getOrigin();
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: input.email,
    });
    const hashedToken = linkData?.properties?.hashed_token;
    if (hashedToken) {
      const nextPath = `${localePath(input.locale, '/account')}?welcome=1`;
      const confirmUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent(nextPath)}`;
      const sendResult = await sendSignupConfirmationEmail({
        customerName: input.fullName,
        customerEmail: input.email,
        confirmUrl,
      });
      if (!sendResult.ok) {
        const missing = missingEmailEnv();
        console.error(
          '[signup] confirmation email failed for',
          input.email,
          '— reason:',
          sendResult.error ?? 'unknown',
          missing.length ? `— missing env: ${missing.join(', ')}` : '',
        );
      }
    }
  } catch (e) {
    console.error('[signup] confirmation email threw for', input.email, e);
  }

  // Send the customer to the login page to sign in themselves (no auto-login),
  // preserving returnTo so they still land where they intended (e.g. checkout).
  const returnTo = String(formData.get('returnTo') ?? '');
  const params = new URLSearchParams({ created: '1' });
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
  let { error } = await supabase.auth.signInWithPassword({ email, password });

  // Email confirmation is optional now (see migration 024). A straggler created
  // before that change (or via another path) may still be unconfirmed in GoTrue,
  // which blocks login BEFORE the password is checked. Confirm on the fly and
  // retry once — the retry still validates the password, so this grants no access
  // it shouldn't, and email_verified is left untouched so the admin badge stays
  // accurate.
  if (error) {
    const code = (error as { code?: string }).code;
    const msg = error.message?.toLowerCase() ?? '';
    if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
      const found = await findUserByEmail(email);
      if (found) {
        const admin = createServiceClient();
        await admin.auth.admin.updateUserById(found.id, { email_confirm: true });
        ({ error } = await supabase.auth.signInWithPassword({ email, password }));
      }
    }
  }
  if (error) return { error: error.message };
  redirect(returnTo ? safeReturnTo(returnTo, locale) : localePath(locale, '/account'));
}

// Resends the email-confirmation link for an UNCONFIRMED account, via our own
// mailer (a magic link, which also confirms the email on first verification).
// Never reveals whether the email exists or its state. No-op for already-
// confirmed accounts so this can't be abused as a passwordless-login channel.
export async function resendConfirmation(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const locale = String(formData.get('locale') ?? 'en');
  if (!email) return { error: 'Please enter your email.' };

  const found = await findUserByEmail(email);
  if (!found) return { success: true };

  const admin = createServiceClient();
  // Every account is confirmed in auth.users now (so login works without email),
  // so email_confirmed_at no longer signals whether the customer verified. Gate on
  // our own flag: only resend to someone who hasn't actually verified yet. Still
  // report success either way so this can't probe which emails exist.
  const { data: prof } = await admin
    .from('customer_profiles')
    .select('email_verified')
    .eq('user_id', found.id)
    .maybeSingle();
  if (!prof || prof.email_verified) return { success: true };

  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const hashedToken = linkData?.properties?.hashed_token;
  if (error || !hashedToken) {
    console.error('[resend-confirmation] generateLink failed:', error?.message);
    return { error: "Couldn't resend the email right now. Please try again shortly." };
  }

  const origin = await getOrigin();
  const nextPath = `${localePath(locale, '/account')}?welcome=1`;
  const confirmUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent(nextPath)}`;

  const { data: profile } = await admin
    .from('customer_profiles')
    .select('full_name')
    .eq('user_id', found.id)
    .maybeSingle();

  const sendResult = await sendSignupConfirmationEmail({
    customerName: profile?.full_name ?? email,
    customerEmail: email,
    confirmUrl,
  });
  if (!sendResult.ok) {
    console.error('[resend-confirmation] send failed:', sendResult.error);
    return { error: "Couldn't resend the email right now. Please try again shortly." };
  }
  return { success: true };
}

// Re-reads the signed-in customer's verification state. Used by the account
// banner's "I've confirmed" button so a customer who just clicked the email link
// (in another tab) can clear the notice without a full reload. Reads via the
// user-scoped client — RLS lets a user read their own profile row.
export async function checkEmailVerified(): Promise<{ verified: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { verified: false };
  const { data } = await supabase
    .from('customer_profiles')
    .select('email_verified')
    .eq('user_id', user.id)
    .maybeSingle();
  return { verified: !!data?.email_verified };
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

  // Write with the service role, scoped to this authenticated user's own row.
  // The profile row is created via the service client at signup; updating it via
  // the RLS-bound anon client was silently affecting 0 rows for some sessions —
  // the action returned success but nothing changed (e.g. country never saved).
  const admin = createServiceClient();
  const { error } = await admin
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
