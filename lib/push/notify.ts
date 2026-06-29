import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPush } from '@/lib/push/webPush';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  count?: number;
}

// Deliver a Web Push to every saved subscription belonging to one customer
// (push_subscriptions.client_code === their auth user id). Best-effort: it
// never throws, so a push failure can't break the in-app message that has
// already been saved. Expired endpoints (404/410) are pruned. Returns a small
// summary for logging.
export async function pushToUser(
  userId: string | null | undefined,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; pruned: number }> {
  let sent = 0;
  let failed = 0;
  const goneIds: number[] = [];
  if (!userId) return { sent, failed, pruned: 0 };

  try {
    const admin = createServiceClient();
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('client_code', userId);

    for (const s of subs ?? []) {
      const r = await sendPush(
        { endpoint: s.endpoint as string, p256dh: s.p256dh as string, auth: s.auth as string },
        payload,
      );
      if (r.ok) sent++;
      else {
        failed++;
        if (r.gone) goneIds.push(s.id as number);
      }
    }
    if (goneIds.length) await admin.from('push_subscriptions').delete().in('id', goneIds);
  } catch {
    // best-effort — the in-app message has already been saved
  }
  return { sent, failed, pruned: goneIds.length };
}
