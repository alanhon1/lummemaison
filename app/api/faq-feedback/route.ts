import { createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { faqNumber, rating, comment } = await req.json();

    if (!faqNumber || !['up', 'down'].includes(rating)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('faq_feedback').insert({
      faq_number: faqNumber,
      rating,
      comment: comment?.trim() || null,
    });

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[/api/faq-feedback]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
