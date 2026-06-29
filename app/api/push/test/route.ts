// app/api/push/test/route.ts
// TEMPORARY admin-only "send a test push" so the owner can verify delivery
// without creating an order. Sends a test notification to EVERY saved
// subscription and returns the per-endpoint web-push result (status code), so a
// 401/403 (bad VAPID) vs 404/410 (expired) vs 201 (delivered) is visible.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push/webPush';

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const admin = createServiceClient();
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, client_code');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, subscriptions: 0, results: [], note: 'No saved subscriptions — the subscribe step has not run on any device.' });
  }

  const results: Array<{ host: string; ok: boolean; status?: number; error?: string }> = [];
  let configError: string | null = null;
  for (const s of subs) {
    let host = '';
    try { host = new URL(s.endpoint as string).host; } catch { host = 'unknown'; }
    const r = await sendPush(
      { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
      { title: 'Lumée Maison — test', body: 'This is a test push 🔔', url: '/account/inbox', count: 1 },
    );
    if (r.ok) results.push({ host, ok: true });
    else {
      results.push({ host, ok: false, status: r.status, error: r.error });
      // A VAPID misconfiguration surfaces as the same thrown message for every row.
      if (/VAPID/i.test(r.error)) configError = r.error;
    }
  }

  return NextResponse.json({
    ok: true,
    subscriptions: subs.length,
    delivered: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    configError,
    results,
  });
}
