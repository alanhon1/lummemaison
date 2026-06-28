// app/api/push/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push/webPush';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { title?: string; body?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const title = (body?.title ?? '').trim();
  const message = (body?.body ?? '').trim();
  const url = (body?.url ?? '').trim() || '/';
  if (!title || !message) {
    return NextResponse.json({ ok: false, error: 'Title and message are required' }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth');

  let sent = 0, failed = 0;
  const goneIds: number[] = [];
  for (const s of subs ?? []) {
    const r = await sendPush(
      { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
      { title, body: message, url, count: 1 },
    );
    if (r.ok) sent++;
    else { failed++; if (r.gone) goneIds.push(s.id as number); }
  }
  if (goneIds.length) await admin.from('push_subscriptions').delete().in('id', goneIds);

  return NextResponse.json({ ok: true, sent, failed, pruned: goneIds.length });
}
