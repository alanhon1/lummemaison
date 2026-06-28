'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// Shape written to the promo_codes row by both create and edit. Deliberately
// excludes used_count and active — editing a code must never reset how many
// times it's been used, and active is controlled by the toggle.
interface PromoFields {
  code: string;
  description: string | null;
  discount_type: string;
  discount_value: number;
  min_order_cents: number;
  max_uses: number | null;
  expires_at: string | null;
  notes: string | null;
  include_shipping: boolean;
}

// Parse + validate the promo form. Shared by createPromoCode and updatePromoCode
// so the two paths can never drift apart.
function parsePromoForm(formData: FormData): { ok: true; values: PromoFields } | { ok: false; error: string } {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Code is required' };
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return { ok: false, error: 'Code must be 2–32 alphanumeric characters (A-Z, 0-9, -, _)' };

  const discountType = String(formData.get('discount_type') ?? '');
  if (!['percent', 'fixed'].includes(discountType)) return { ok: false, error: 'Invalid discount type' };

  const discountValue = Number(formData.get('discount_value'));
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { ok: false, error: 'Discount value must be a positive number' };
  if (discountType === 'percent' && discountValue > 100) return { ok: false, error: 'Percent discount cannot exceed 100' };

  const minOrderRaw = Number(formData.get('min_order_cents') ?? 0);
  const minOrderCents = Number.isFinite(minOrderRaw) && minOrderRaw >= 0 ? Math.round(minOrderRaw) : 0;

  const maxUsesRaw = formData.get('max_uses');
  const maxUses = maxUsesRaw && String(maxUsesRaw).trim() !== '' ? Number(maxUsesRaw) : null;
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) return { ok: false, error: 'Max uses must be a positive integer' };

  const expiresAtRaw = String(formData.get('expires_at') ?? '').trim();
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null;

  const description = String(formData.get('description') ?? '').trim().slice(0, 200) || null;
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null;
  const includeShipping = formData.get('include_shipping') === '1';

  return {
    ok: true,
    values: {
      code,
      description,
      discount_type: discountType,
      discount_value: Math.round(discountValue),
      min_order_cents: minOrderCents,
      max_uses: maxUses,
      expires_at: expiresAt,
      notes,
      include_shipping: includeShipping,
    },
  };
}

export async function createPromoCode(formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const parsed = parsePromoForm(formData);
  if (!parsed.ok) return parsed;

  const supabase = createServiceClient();
  const { error } = await supabase.from('promo_codes').insert(parsed.values);

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Code "${parsed.values.code}" already exists` };
    return { ok: false, error: error.message };
  }

  revalidatePath('/manzura/promos');
  return { ok: true };
}

// Edit an existing code. used_count and active are NOT in the update payload, so
// the usage count is preserved exactly and the active state stays as the toggle
// left it.
export async function updatePromoCode(id: number, formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Invalid code id' };

  const parsed = parsePromoForm(formData);
  if (!parsed.ok) return parsed;

  const supabase = createServiceClient();
  const { error } = await supabase.from('promo_codes').update(parsed.values).eq('id', id);

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Code "${parsed.values.code}" already exists` };
    return { ok: false, error: error.message };
  }

  revalidatePath('/manzura/promos');
  return { ok: true };
}

export async function togglePromoCode(id: number, active: boolean): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const supabase = createServiceClient();
  const { error } = await supabase.from('promo_codes').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/manzura/promos');
  return { ok: true };
}

export async function deletePromoCode(id: number): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

  const supabase = createServiceClient();
  // Only delete if never used
  const { data } = await supabase.from('promo_codes').select('used_count').eq('id', id).single();
  if (data && (data.used_count as number) > 0) {
    return { ok: false, error: 'Cannot delete a code that has been used. Deactivate it instead.' };
  }

  const { error } = await supabase.from('promo_codes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/manzura/promos');
  return { ok: true };
}
