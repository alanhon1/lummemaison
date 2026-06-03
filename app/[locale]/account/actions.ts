'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type FormState = { error?: string; success?: boolean };

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

  // Use the admin API for creation — it's synchronous (no eventual-consistency
  // race between auth.users insert and the customer_profiles FK check that
  // bit us with anon.auth.signUp) and bypasses Supabase's internal email
  // rate limiter. `email_confirm: true` marks the user as confirmed so they
  // can sign in immediately without a confirmation email round-trip (which
  // was the source of the rate-limit failures). For a B2B wholesale catalogue
  // with manual onboarding this is acceptable; revisit if open self-service
  // signup becomes a vector for abuse.
  const admin = createServiceClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (createError) return { error: createError.message };
  if (!created.user) return { error: 'Unable to create account. Please try again.' };

  // Insert the profile via the same service-role client; the auth.users row
  // is fully committed by the time createUser returns, so the FK reference
  // is guaranteed valid.
  const { error: profileError } = await admin.from('customer_profiles').insert({
    user_id: created.user.id,
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
    // Roll back the auth user so the customer can retry with the same email.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  // The customer didn't go through email-confirmation, so they don't have a
  // session yet. Sign them in with their just-set password so they land on
  // /account already authenticated.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  if (signInError) {
    // Account + profile exist, but session creation failed. Send them to
    // login to try again rather than dropping them into a half-state.
    redirect(`/${input.locale}/account/login`);
  }

  const returnTo = String(formData.get('returnTo') ?? '');
  redirect(returnTo ? safeReturnTo(returnTo, input.locale) : `/${input.locale}/account`);
}

function safeReturnTo(value: string, locale: string): string {
  // Only allow same-origin paths under the active locale to prevent open
  // redirects. Falls back to /[locale]/account.
  if (value.startsWith(`/${locale}/`) && !value.startsWith(`/${locale}//`)) {
    return value;
  }
  return `/${locale}/account`;
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

  if (error) return { error: error.message };
  redirect(returnTo ? safeReturnTo(returnTo, locale) : `/${locale}/account`);
}

export async function logout(locale: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(`/${locale}`);
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
