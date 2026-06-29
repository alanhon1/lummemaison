// app/api/push/diag/route.ts
// TEMPORARY admin-only diagnostics for the Web Push pipeline. Read-only.
// Reports how many subscriptions are stored and whether the VAPID env vars are
// present in THIS (production) runtime — the two things that silently break push.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createServiceClient();
  const { count, error } = await admin
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true });

  const { count: withCode } = await admin
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .not('client_code', 'is', null);

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    subscriptions: count ?? 0,
    withClientCode: withCode ?? 0,
    vapidPublicSet: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapidPrivateSet: !!process.env.VAPID_PRIVATE_KEY,
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:info@lumeemaison.com (default)',
  });
}
