import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Signup-confirmation callback. The signup server action mails a link that
// points here with ?token_hash=<hash>&type=email&next=<path>. We hand the
// token_hash to verifyOtp on the SSR client — that both marks the user's
// email as confirmed in auth.users AND drops session cookies onto our own
// domain (something Supabase's hosted /auth/v1/verify can't do for us).
// On success we redirect to ?next; on failure we punt to the login page
// with a generic error flag so the customer sees something actionable.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  // 'email' = original signup confirmation link; 'magiclink' = the resend flow
  // (a magic link also confirms the email on first verification).
  const typeParam = searchParams.get('type');
  const type = typeParam === 'email' || typeParam === 'magiclink' ? typeParam : null;
  const next = searchParams.get('next') ?? '/account';

  // Sanitise next to same-origin paths only — defence against open-redirect
  // gadgets if someone ever rewrites confirm URLs.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/account';

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/account/login?confirmError=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    const reason = error.message.toLowerCase().includes('expired') ? 'expired' : 'invalid';
    return NextResponse.redirect(`${origin}/account/login?confirmError=${reason}`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
