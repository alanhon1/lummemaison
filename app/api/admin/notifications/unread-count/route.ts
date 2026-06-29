// app/api/admin/notifications/unread-count/route.ts
// Powers the admin nav bell badge. Admin-only; returns the count of unread
// admin_notifications. Never throws (returns 0 on error) so the nav stays calm.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const admin = createServiceClient();
    const { count } = await admin
      .from('admin_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
