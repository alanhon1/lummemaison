import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'crypto';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

// In-memory brute-force guard: max 10 attempts per IP per 15-minute window.
// Serverless-safe — each instance has its own map, so this is per-instance
// rate limiting. Combined with a strong password it is adequate for this site.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

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

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in 15 minutes.' },
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

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.loggedIn = true;
  session.username = username;
  await session.save();
  return res;
}
