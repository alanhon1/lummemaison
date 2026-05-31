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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.fullName } },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: 'Unable to create account. Please try again.' };

  // Insert the profile via the service role so we don't need RLS write policies
  // that depend on the just-created session.
  const admin = createServiceClient();
  const { error: profileError } = await admin.from('customer_profiles').insert({
    user_id: data.user.id,
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
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
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
