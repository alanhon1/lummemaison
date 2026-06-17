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

  // Inbound targets the optionless row (option ''); product_stock is keyed by
  // (product_id, option) since migration 027, so the upsert must conflict on the
  // composite key — `onConflict: 'product_id'` errors (42P10) and silently broke
  // both the stock bump and its history row.
  const { data: currentRow } = await supabase
    .from('product_stock')
    .select('stock')
    .eq('product_id', productId)
    .eq('option', '')
    .maybeSingle();
  const newStock = ((currentRow?.stock as number | null) ?? 0) + qty;
  // Receiving stock means the count is now real — clear the "arbitrarily
  // assigned" (S) flag and the legacy unknown flag.
  const { error: stockErr } = await supabase
    .from('product_stock')
    .upsert({ product_id: productId, option: '', stock: newStock, wonder: false, stock_unknown: false }, { onConflict: 'product_id,option' });
  if (stockErr) return { ok: false, error: stockErr.message };

  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: productId,
    option: '',
    delta: qty,
    reason: 'inbound',
    company_id: companyId,
    note,
  });
  if (movErr) return { ok: false, error: movErr.message };

  revalidatePath('/manzura/stock');
  return { ok: true };
}

export interface BatchItem {
  product_id: number;
  quantity: number;
  note: string | null;
}

// Add multiple products as one inbound batch.
// Creates an inbound_batches record and links all movements via batch_id.
export async function addInboundBatch(
  _prev: StockActionResult | null,
  formData: FormData,
): Promise<StockActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'Not authorized.' };
  }

  const companyName = (formData.get('company_name') as string | null)?.trim();
  const inboundDate = (formData.get('inbound_date') as string | null)?.trim() || new Date().toISOString().slice(0, 10);
  const memo = (formData.get('memo') as string | null)?.trim() || null;
  const itemsRaw = formData.get('items') as string | null;

  if (!companyName) return { ok: false, error: 'Company name is required.' };
  if (!itemsRaw) return { ok: false, error: 'Add at least one product.' };

  let items: BatchItem[];
  try {
    items = JSON.parse(itemsRaw) as BatchItem[];
  } catch {
    return { ok: false, error: 'Invalid items data.' };
  }
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Add at least one product.' };
  for (const item of items) {
    if (!item.product_id || item.quantity <= 0) return { ok: false, error: 'Each item needs a valid product and quantity > 0.' };
  }

  const supabase = createServiceClient();

  let companyId: number;
  try {
    companyId = await upsertCompany(supabase, companyName);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Create the batch record.
  const { data: batch, error: batchErr } = await supabase
    .from('inbound_batches')
    .insert({ company_id: companyId, inbound_date: inboundDate, memo })
    .select('id')
    .single();
  if (batchErr || !batch) return { ok: false, error: batchErr?.message ?? 'Failed to create batch.' };
  const batchId = (batch as { id: number }).id;

  // For each item: increment stock + log movement.
  for (const item of items) {
    const { data: currentRow } = await supabase
      .from('product_stock')
      .select('stock')
      .eq('product_id', item.product_id)
      .eq('option', '')
      .maybeSingle();
    const newStock = ((currentRow?.stock as number | null) ?? 0) + item.quantity;
    // Receiving stock means the count is now real — clear the "arbitrarily
    // assigned" (S) flag and the legacy unknown flag.
    const { error: stockErr } = await supabase
      .from('product_stock')
      .upsert({ product_id: item.product_id, option: '', stock: newStock, wonder: false, stock_unknown: false }, { onConflict: 'product_id,option' });
    if (stockErr) return { ok: false, error: `Stock update failed for product ${item.product_id}: ${stockErr.message}` };

    const { error: movErr } = await supabase.from('stock_movements').insert({
      product_id: item.product_id,
      option: '',
      delta: item.quantity,
      reason: 'inbound',
      company_id: companyId,
      note: item.note,
      batch_id: batchId,
    });
    if (movErr) return { ok: false, error: movErr.message };
  }

  revalidatePath('/manzura/stock');
  return { ok: true };
}

export async function deleteStockMovements(ids: number[]): Promise<StockActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: 'Not authorized.' };
  }
  if (ids.length === 0) return { ok: true };

  const supabase = createServiceClient();
  const { error } = await supabase.from('stock_movements').delete().in('id', ids);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/manzura/stock');
  return { ok: true };
}
