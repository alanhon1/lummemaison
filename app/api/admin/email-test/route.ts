import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { getTransporter, missingEmailEnv } from '@/lib/email/mailer';

// Admin-only SMTP diagnostic. Vercel hides env VALUES and runtime logs are
// short-lived, so "emails aren't arriving" is otherwise a black box. This
// endpoint surfaces the EXACT failure:
//   GET /api/admin/email-test            → checks env presence + verifies the
//                                          SMTP connection/auth (no email sent)
//   GET /api/admin/email-test?to=you@x   → also sends a real test email and
//                                          returns the real send error, if any
// Log into /manzura first (sets the admin session cookie), then open the URL.
export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return new Response('Unauthorized', { status: 401 });

  const result: Record<string, unknown> = {
    env: {
      missing: missingEmailEnv(), // empty array = all required vars present
      host: process.env.SMTP_HOST ?? null,
      port: process.env.SMTP_PORT ?? null,
      userSet: !!process.env.SMTP_USER,
      passSet: !!process.env.SMTP_PASS,
      from: process.env.SMTP_FROM ?? null,
      adminTo: process.env.ADMIN_NOTIFICATION_EMAIL ?? null,
    },
  };

  // 1) Verify the SMTP connection + credentials without sending anything.
  try {
    const transporter = getTransporter();
    await transporter.verify();
    result.verify = 'ok';
  } catch (e) {
    result.verify = 'failed';
    result.verifyError = e instanceof Error ? e.message : String(e);
    return NextResponse.json(result, { status: 200 });
  }

  // 2) Optional real send, only when ?to= is provided.
  const to = new URL(req.url).searchParams.get('to');
  if (to) {
    try {
      const info = await getTransporter().sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject: 'Lumée Maison — SMTP test',
        text: 'If you are reading this, outbound email from the live site works.',
      });
      result.send = 'ok';
      result.messageId = info.messageId;
    } catch (e) {
      result.send = 'failed';
      result.sendError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(result, { status: 200 });
}
