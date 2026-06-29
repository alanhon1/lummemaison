// app/api/push/unsubscribe/route.ts
// Turn alerts OFF: delete the saved subscription row so future broadcasts skip
// this device/user (the owner rule: only ON users are saved/notified). The
// browser-side unsubscribe happens in pushClient before this is called.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  let body: { endpoint?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!body.endpoint) return NextResponse.json({ ok: false, error: 'missing endpoint' }, { status: 400 });

  // Scope the delete to the signed-in user when there is a session, so a request
  // can only remove that user's own subscription (not anyone's by endpoint).
  // Logged-out callers (anonymous subscriptions, client_code null) fall back to
  // delete-by-endpoint — the endpoint is a high-entropy capability token.
  let userId: string | null = null;
  try {
    const supa = await createClient();
    userId = (await supa.auth.getUser()).data.user?.id ?? null;
  } catch { userId = null; }

  const admin = createServiceClient();
  let q = admin.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
  if (userId) q = q.eq('client_code', userId);
  const { error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
