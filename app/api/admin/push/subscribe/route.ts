// app/api/admin/push/subscribe/route.ts
// Phase 3: admin (owner) device subscribes for order-alert Web Push. Admin has
// no Supabase auth user (iron-session login), so the subscription is tagged with
// the reserved client_code ADMIN_PUSH_CODE instead of a user id. notifyAdmin()
// pushes to every subscription carrying that code.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { ADMIN_PUSH_CODE } from '@/lib/push/notify';

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: 'invalid subscription' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh, auth, client_code: ADMIN_PUSH_CODE }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
