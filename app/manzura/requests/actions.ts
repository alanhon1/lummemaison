'use server';

import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { REQUESTS_TAG, type RequestStatus } from '@/lib/requests';

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: 'auth' };

const revalidateRequests = () => (revalidateTag as (tag: string) => void)(REQUESTS_TAG);

async function requireAdmin() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) throw new Error('not authorized');
}

export interface SubmitRequestInput {
  productId: number;
  productName: string;
  option?: string | null;
  quantity: number;
}

// PUBLIC (storefront) but LOGIN-REQUIRED — called from the RequestModal when a
// product is out of stock. Records how many units the customer wants so the
// owner can gauge demand. A signed-in customer is required: this is the
// authoritative gate (the client also blocks, but never trust the client).
export async function submitProductRequest(input: SubmitRequestInput): Promise<ActionResult> {
  const productId = Number(input.productId);
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(productId) || productId <= 0) return { ok: false, error: 'Invalid product.' };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Please choose how many you want.' };
  if (quantity > 100000) return { ok: false, error: 'Quantity is too large.' };

  // Require a signed-in customer. Attach their identity to the request.
  let userId: string;
  let email: string | null = null;
  let name: string | null = null;
  try {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return { ok: false, error: 'Please log in to make a request.', code: 'auth' };
    userId = user.id;
    email = user.email ?? null;
    name = (user.user_metadata?.full_name as string | undefined) ?? null;
  } catch {
    return { ok: false, error: 'Please log in to make a request.', code: 'auth' };
  }

  const admin = createServiceClient();
  const { error } = await admin.from('product_requests').insert({
    product_id: productId,
    product_name: String(input.productName ?? '').slice(0, 300),
    option: input.option ? String(input.option).slice(0, 120) : null,
    quantity,
    user_id: userId,
    customer_email: email,
    customer_name: name,
  });
  if (error) return { ok: false, error: error.message };

  revalidateRequests();
  return { ok: true };
}

export async function setRequestStatus(id: number, status: RequestStatus): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }
  const admin = createServiceClient();
  const { error } = await admin.from('product_requests').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidateRequests();
  revalidatePath('/manzura/requests');
  return { ok: true };
}

export async function deleteRequest(id: number): Promise<ActionResult> {
  try { await requireAdmin(); } catch { return { ok: false, error: 'not authorized' }; }
  const admin = createServiceClient();
  const { error } = await admin.from('product_requests').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidateRequests();
  revalidatePath('/manzura/requests');
  return { ok: true };
}
