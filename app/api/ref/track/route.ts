import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { REF_COOKIE, REF_COOKIE_MAX_AGE, normalizeReferralCode } from '@/lib/referrals';

// Called by ReferralCapture on any landing with ?ref=<code>: counts the click
// (known active codes only) and sets the first-touch referral cookie. An
// existing cookie is never overwritten, but the click still counts — every
// link tap belongs to the influencer whose link it was.
export async function POST(req: NextRequest) {
  let body: unknown = null;
  try { body = await req.json(); } catch { /* fall through to 400 */ }
  const code = normalizeReferralCode((body as { code?: string } | null)?.code);
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const supabase = createServiceClient();
    await supabase.rpc('increment_referral_clicks', { p_code: code });
  } catch {
    // Tracking must never break the page for the visitor.
  }

  const res = NextResponse.json({ ok: true });
  if (!req.cookies.get(REF_COOKIE)?.value) {
    res.cookies.set(REF_COOKIE, code, {
      maxAge: REF_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return res;
}
