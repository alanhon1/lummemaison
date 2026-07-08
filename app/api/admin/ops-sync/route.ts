import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { syncOrderStatusFromOpsHub } from '@/lib/ops/sync';

// Triggered from the admin orders page on load (OpsSyncTrigger): pulls order
// statuses from the ops hub and applies packaging/shipped transitions. The
// proxy already gates /api/admin/*, but we re-check the session anyway.
export async function POST() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const result = await syncOrderStatusFromOpsHub();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error('[ops-sync] failed:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
