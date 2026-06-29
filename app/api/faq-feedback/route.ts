import { createServiceClient } from '@/lib/supabase/server';
import { clientIp } from '@/lib/rate-limit-ip';

// Unauthenticated endpoint — cap submissions per IP so it can't be scripted to
// flood the faq_feedback table. In-memory (per serverless instance), which is
// enough to blunt casual abuse; the strict input validation below bounds the
// damage of anything that gets through.
const RL = new Map<string, { count: number; resetAt: number }>();
const RL_MAX = 20;
const RL_WINDOW_MS = 10 * 60 * 1000;

function rateLimited(req: Request): boolean {
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

export async function POST(req: Request) {
  try {
    if (rateLimited(req)) {
      return Response.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { faqNumber, rating, comment } = await req.json();

    if (
      typeof faqNumber !== 'number' ||
      !Number.isInteger(faqNumber) ||
      faqNumber < 1 ||
      faqNumber > 999 ||
      !['up', 'down'].includes(rating)
    ) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const trimmedComment = typeof comment === 'string' ? comment.trim().slice(0, 2000) : null;

    const supabase = createServiceClient();
    const { error } = await supabase.from('faq_feedback').insert({
      faq_number: faqNumber,
      rating,
      comment: trimmedComment || null,
    });

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[/api/faq-feedback]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
