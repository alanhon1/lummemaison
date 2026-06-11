import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'crypto';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase/server';

// Brute-force guard: max 8 attempts per IP per 30-minute window.
//
// Two layers: an in-memory Map (fast, but per serverless instance) AND a shared
// Supabase table (admin_login_attempts, migration 020) so the limit holds
// GLOBALLY across instances/cold-starts. A request is blocked if EITHER layer
// trips. The DB layer is best-effort — if Supabase is unreachable the in-memory
// guard still applies and legitimate logins are never blocked by an outage.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 30 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

function clearRateLimit(ip: string) {
  attempts.delete(ip);
}

// Shared cross-instance counter. Returns false when the IP is over the limit.
async function checkRateLimitDb(ip: string): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const now = Date.now();
    const { data } = await sb
      .from('admin_login_attempts')
      .select('count, reset_at')
      .eq('ip', ip)
      .maybeSingle();

    if (!data || new Date(data.reset_at).getTime() < now) {
      await sb
        .from('admin_login_attempts')
        .upsert({ ip, count: 1, reset_at: new Date(now + WINDOW_MS).toISOString() });
      return true;
    }
    if (data.count >= MAX_ATTEMPTS) return false;
    await sb.from('admin_login_attempts').update({ count: data.count + 1 }).eq('ip', ip);
    return true;
  } catch {
    // Table missing / DB down → fall back to the in-memory guard only.
    return true;
  }
}

async function clearRateLimitDb(ip: string) {
  try {
    await createServiceClient().from('admin_login_attempts').delete().eq('ip', ip);
  } catch {
    /* best-effort */
  }
}

function safeEqual(a: string, b: string): boolean {
  try {
    // timingSafeEqual requires same-length buffers; hash both to normalise length.
    const ha = createHash('sha256').update(a).digest();
    const hb = createHash('sha256').update(b).digest();
    return timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const allowedMem = checkRateLimit(ip);
  const allowedDb = await checkRateLimitDb(ip);
  if (!allowedMem || !allowedDb) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 30 minutes.' },
      { status: 429 },
    );
  }

  const { username, password } = await req.json();
  const validUser = process.env.ADMIN_USERNAME?.trim() ?? '';
  const validPass = process.env.ADMIN_PASSWORD?.trim() ?? '';

  if (
    !validUser ||
    !validPass ||
    !safeEqual(username ?? '', validUser) ||
    !safeEqual(password ?? '', validPass)
  ) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  clearRateLimit(ip);
  await clearRateLimitDb(ip);

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.loggedIn = true;
  session.username = username;
  await session.save();
  return res;
}
