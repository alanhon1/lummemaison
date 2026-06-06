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

export type StockActionResult = { ok: true } | { ok: false; error: string };

// Upsert a company by name; return its id.
async function upsertCompany(supabase: ReturnType<typeof createServiceClient>, name: string): Promise<number> {
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing) return existing.id as number;
  const { data: inserted, error } = await supabase
    .from('companies')
    .insert({ name })
    .select('id')
    .single();
  if (error || !inserted) throw new Error(error?.message ?? 'Failed to create company');
  return inserted.id as number;
}

export async function addInbound(
  _prev: StockActionResult | null,
  formData: FormData,
): Promise<StockActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'Not authorized.' };
  }

  const companyName = (formData.get('company_name') as string | null)?.trim();
  const productIdRaw = formData.get('product_id');
  const qtyRaw = formData.get('quantity');
  const note = (formData.get('note') as string | null)?.trim() || null;

  if (!companyName) return { ok: false, error: 'Company name is required.' };
  const productId = Number.parseInt(String(productIdRaw ?? ''), 10);
  if (!Number.isFinite(productId) || productId <= 0) return { ok: false, error: 'Select a product.' };
  const qty = Number.parseInt(String(qtyRaw ?? ''), 10);
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: 'Quantity must be a positive number.' };

  const supabase = createServiceClient();

  let companyId: number;
  try {
    companyId = await upsertCompany(supabase, companyName);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Increment stock atomically.
  const { error: rpcErr } = await supabase.rpc('restore_stock_for_cancel', {
    items: [{ product_id: productId, quantity: qty }],
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  // Log movement.
  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: productId,
    delta: qty,
    reason: 'inbound',
    company_id: companyId,
    note,
  });
  if (movErr) return { ok: false, error: movErr.message };

  revalidatePath('/manzura/stock');
  return { ok: true };
}
