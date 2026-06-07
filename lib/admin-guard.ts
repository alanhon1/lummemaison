import 'server-only';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import { NextResponse } from 'next/server';

// Returns a 401 Response if the request has no valid admin session,
// or null if the caller may proceed. Usage:
//   const denied = await requireAdmin();
//   if (denied) return denied;
export async function requireAdmin(): Promise<Response | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.loggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
