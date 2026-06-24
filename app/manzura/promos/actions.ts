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

export async function createPromoCode(formData: FormData): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }

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

  // Flat shipping override (cents). Blank = keep the normal computed rate.
  const flatShipRaw = formData.get('flat_shipping_cents');
  const flatShippingCents =
    flatShipRaw && String(flatShipRaw).trim() !== '' ? Math.round(Number(flatShipRaw)) : null;
  if (flatShippingCents !== null && (!Number.isFinite(flatShippingCents) || flatShippingCents < 0)) {
    return { ok: false, error: 'Flat shipping must be a non-negative number of cents' };
  }

  // Categories the % must skip (still count toward the minimum). Accepts a
  // multi-select and/or comma-separated values.
  const excludeCategoryIds = formData
    .getAll('exclude_category_ids')
    .flatMap(v => String(v).split(','))
    .map(v => v.trim())
    .filter(Boolean);

  const supabase = createServiceClient();
  const { error } = await supabase.from('promo_codes').insert({
    code,
    description,
    discount_type: discountType,
    discount_value: Math.round(discountValue),
    min_order_cents: minOrderCents,
    max_uses: maxUses,
    expires_at: expiresAt,
    notes,
    include_shipping: includeShipping,
    flat_shipping_cents: flatShippingCents,
    exclude_category_ids: excludeCategoryIds,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: `Code "${code}" already exists` };
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
