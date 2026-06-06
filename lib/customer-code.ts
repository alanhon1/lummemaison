import 'server-only';

import { randomInt } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';

// Customer ID: 4 digits + 4 uppercase letters, e.g. "4821KQXM". Admin-only — it
// is never shown to the customer. Assigned on a customer's first confirmed login
// (see ensureCustomerCode), unique across customer_profiles.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateCustomerCode(): string {
  let digits = '';
  for (let i = 0; i < 4; i++) digits += randomInt(0, 10);
  let letters = '';
  for (let i = 0; i < 4; i++) letters += LETTERS[randomInt(0, LETTERS.length)];
  return digits + letters;
}

// Ensures the profile has a customer_code, generating + persisting a unique one
// if missing. Returns the code, or null if the profile doesn't exist. Idempotent
// and concurrency-safe: the update only fills a NULL code, and a unique-violation
// (another code already taken) is retried with a fresh code.
export async function ensureCustomerCode(userId: string): Promise<string | null> {
  const admin = createServiceClient();

  const { data: profile } = await admin
    .from('customer_profiles')
    .select('customer_code')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile) return null;
  if (profile.customer_code) return profile.customer_code as string;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCustomerCode();
    const { data, error } = await admin
      .from('customer_profiles')
      .update({ customer_code: code })
      .eq('user_id', userId)
      .is('customer_code', null)
      .select('customer_code')
      .maybeSingle();

    if (!error && data?.customer_code) return data.customer_code as string;

    // Unique collision on the generated code — try a different one.
    if (error && (error as { code?: string }).code === '23505') continue;

    // No error but no row updated → another request set the code first. Re-read.
    if (!error && !data) {
      const { data: again } = await admin
        .from('customer_profiles')
        .select('customer_code')
        .eq('user_id', userId)
        .maybeSingle();
      if (again?.customer_code) return again.customer_code as string;
    }

    if (error && (error as { code?: string }).code !== '23505') return null;
  }
  return null;
}
