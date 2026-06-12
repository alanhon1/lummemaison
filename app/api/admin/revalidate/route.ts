import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Cache-busting hook for CLI scripts (e.g. apply-fake-discounts) that write the
// catalogue Storage object DIRECTLY and therefore can't call revalidateTag in a
// production request scope — so the live site would otherwise keep serving the
// cached catalogue for up to the 5-min revalidate window. The script POSTs here
// after writing, and this route (running in the deployment) busts the tag.
//
// Authenticated with the shared SESSION_SECRET (a server-only secret present in
// both .env.local and the Vercel env). Only revalidates a cache tag — it reads
// and changes no data — so the blast radius is nil even if the secret leaked.
export async function POST(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const provided = req.headers.get('x-revalidate-secret');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let tag = 'catalogue';
  try {
    const body = (await req.json()) as { tag?: unknown };
    if (typeof body?.tag === 'string' && body.tag.trim()) tag = body.tag.trim();
  } catch {
    // No/invalid body — default to the catalogue tag.
  }

  // Next 16 types revalidateTag as (tag, profile); this project is not on
  // cacheComponents and uses the legacy single-arg form (see lib/catalogue-store.ts).
  (revalidateTag as (t: string) => void)(tag);
  return NextResponse.json({ ok: true, tag });
}
