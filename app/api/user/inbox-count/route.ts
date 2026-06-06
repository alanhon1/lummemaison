import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ count: 0 });

    const { count } = await supabase
      .from('user_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return Response.json({ count: count ?? 0 });
  } catch {
    return Response.json({ count: 0 });
  }
}
