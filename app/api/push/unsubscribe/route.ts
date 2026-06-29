// app/api/push/unsubscribe/route.ts
// Turn alerts OFF: delete the saved subscription row so future broadcasts skip
// this device/user (the owner rule: only ON users are saved/notified). The
// browser-side unsubscribe happens in pushClient before this is called.
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: { endpoint?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: 'missing endpoint' }, { status: 400 });

  const admin = createServiceClient();
  const { error } = await admin.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
