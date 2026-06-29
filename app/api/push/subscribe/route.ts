// app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { clientIp } from '@/lib/rate-limit-ip';

// Unauthenticated endpoint — cap subscribe attempts per IP so it can't be
// scripted to flood push_subscriptions. In-memory (per serverless instance),
// which is enough to blunt casual abuse; the upsert-by-endpoint below means a
// real client's repeats are idempotent rather than additive anyway. Mirrors the
// limiter in app/api/faq-feedback/route.ts.
const RL = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 20;
const RL_WINDOW_MS = 10 * 60 * 1000;

function rateLimited(req: NextRequest): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const e = RL.get(ip);
  if (!e || now > e.resetAt) {
    RL.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  if (e.count >= RL_MAX) return true;
  e.count++;
  return false;
}

export async function POST(req: NextRequest) {
  if (rateLimited(req)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: 'invalid subscription' }, { status: 400 });
  }

  // Link to the customer if signed in (anon subscriptions are allowed — client_code null).
  let clientCode: string | null = null;
  try {
    const supa = await createClient();
    const { data: { user } } = await supa.auth.getUser();
    clientCode = user?.id ?? null;
  } catch { clientCode = null; }

  const admin = createServiceClient();
  const { error } = await admin
    .from('push_subscriptions')
    .upsert({ endpoint, p256dh, auth, client_code: clientCode }, { onConflict: 'endpoint' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
