import 'server-only';

// Trusted client IP for rate limiting on Vercel.
//
// DON'T use the leftmost token of `x-forwarded-for`: that value is supplied by
// the client and an attacker can rotate it to get a fresh limiter bucket on
// every request, defeating brute-force/abuse counters. Vercel overwrites
// `x-vercel-forwarded-for` and `x-real-ip` with the real connecting IP and
// strips any client-supplied copies, so those are trustworthy. Fall back to the
// LAST entry of `x-forwarded-for` (the hop Vercel appended) only if needed.
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0]!.trim();

  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!; // rightmost = platform-appended
  }
  return 'unknown';
}
