'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';
import { normalizeReferralCode } from '@/lib/referrals';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createReferralCode(formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const code = normalizeReferralCode(String(formData.get('code') ?? ''));
  if (!code) return { ok: false, error: 'Code must be 2–64 characters (a-z, 0-9, -, _)' };

  const influencerName = String(formData.get('influencer_name') ?? '').trim().slice(0, 100);
  if (!influencerName) return { ok: false, error: 'Influencer name is required' };

  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null;

  const supabase = createServiceClient();
  const { error } = await supabase.from('referral_codes').insert({
    code,
    influencer_name: influencerName,
    notes,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Code "${code}" already exists` };
    return { ok: false, error: error.message };
  }

  revalidatePath('/manzura/referrals');
  return { ok: true };
}

// Edit name/notes only — the code itself is frozen after creation because past
// orders reference it as plain text; renaming would orphan their attribution.
export async function updateReferralCode(id: number, formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Invalid code id' };

  const influencerName = String(formData.get('influencer_name') ?? '').trim().slice(0, 100);
  if (!influencerName) return { ok: false, error: 'Influencer name is required' };
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('referral_codes')
    .update({ influencer_name: influencerName, notes })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/manzura/referrals');
  return { ok: true };
}

export async function toggleReferralCode(id: number, active: boolean): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const supabase = createServiceClient();
  const { error } = await supabase.from('referral_codes').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/manzura/referrals');
  return { ok: true };
}
