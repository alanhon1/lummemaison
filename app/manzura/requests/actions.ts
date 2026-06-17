'use server';

import { cookies } from 'next/headers';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { REQUESTS_TAG, type RequestStatus } from '@/lib/requests';

export type ActionResult = { ok: true } | { ok: false; error: string };

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

// PUBLIC — called from the storefront RequestModal when a product is out of
// stock. Records how many units the customer wants. Attaches the signed-in
// customer (email/name) when there is one; anonymous submissions are allowed
// since the request is just a demand signal.
export async function submitProductRequest(input: SubmitRequestInput): Promise<ActionResult> {
  const productId = Number(input.productId);
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(productId) || productId <= 0) return { ok: false, error: 'Invalid product.' };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Please choose how many you want.' };
  if (quantity > 100000) return { ok: false, error: 'Quantity is too large.' };

  // Identify the customer if they're signed in (best-effort).
  let userId: string | null = null;
  let email: string | null = null;
  let name: string | null = null;
  try {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user) {
      userId = user.id;
      email = user.email ?? null;
      name = (user.user_metadata?.full_name as string | undefined) ?? null;
    }
  } catch {
    // Not signed in / auth unavailable — record anonymously.
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
