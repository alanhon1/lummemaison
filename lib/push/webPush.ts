// lib/push/webPush.ts
import webpush from 'web-push';

export interface PushSubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@lumeemaison.com';
  if (!pub || !priv) throw new Error('VAPID keys are not configured');
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export async function sendPush(
  sub: PushSubRow,
  payload: { title: string; body: string; url?: string; count?: number },
): Promise<{ ok: true } | { ok: false; gone: boolean; status?: number; error: string }> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode;
    const gone = status === 404 || status === 410; // subscription expired/unsubscribed
    return { ok: false, gone, status, error: (e as Error).message };
  }
}
