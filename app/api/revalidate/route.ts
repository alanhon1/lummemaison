import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

// Cache-busting hook for CLI scripts (apply-fake-discounts, add-neogenesis-pdo)
// that write the catalogue Storage object DIRECTLY and so can't call
// revalidateTag in a production request scope — without this the live site keeps
// serving the cached catalogue for up to the 5-min revalidate window.
//
// IMPORTANT: this lives OUTSIDE /api/admin on purpose. The admin proxy
// middleware (proxy.ts) blocks every /api/admin/* request that lacks an admin
// session, so a route there can never be reached by a CLI. Authentication is via
// REVALIDATE_SECRET (the same value in .env.local and the Vercel env). It only
// revalidates a cache tag — no data is read or changed.
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  const provided = req.headers.get('x-revalidate-secret')?.trim();
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

  // Next 16 types revalidateTag as (tag, profile); this project uses the legacy
  // single-arg form (see lib/catalogue-store.ts).
  (revalidateTag as (t: string) => void)(tag);
  return NextResponse.json({ ok: true, tag });
}
