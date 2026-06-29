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

export interface BroadcastOpts {
  title: string;
  body: string;
  url?: string;
  kind?: 'announcement' | 'product' | 'system';
  productId?: number;
}

// Targeted broadcast: send to every logged-in user whose push is ON (i.e. has a
// push_subscriptions row). Inserts ONE inbox row per user (so it appears in
// /account/inbox as unread, with a click-through url) AND Web-Pushes their
// devices. Users with push OFF get neither — the owner's rule is "only when ON
// does it save". Best-effort; returns a small summary.
export async function notifyUsers(opts: BroadcastOpts): Promise<{ users: number; pushed: number }> {
  const admin = createServiceClient();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('client_code')
    .not('client_code', 'is', null);
  const userIds = [...new Set((subs ?? []).map(s => s.client_code as string))];
  if (userIds.length === 0) return { users: 0, pushed: 0 };

  // Inbox rows — subject = title; url/kind/product_id drive the click-through.
  const rows = userIds.map(uid => ({
    user_id: uid,
    subject: opts.title,
    body: opts.body,
    url: opts.url ?? null,
    kind: opts.kind ?? 'announcement',
    product_id: opts.productId ?? null,
  }));
  await admin.from('user_messages').insert(rows);

  let pushed = 0;
  for (const uid of userIds) {
    const r = await pushToUser(uid, { title: opts.title, body: opts.body, url: opts.url, count: 1 });
    pushed += r.sent;
  }
  return { users: userIds.length, pushed };
}
