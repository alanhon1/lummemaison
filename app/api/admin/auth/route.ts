import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  const validUser = (process.env.ADMIN_USERNAME ?? 'manzura').trim();
  const validPass = (process.env.ADMIN_PASSWORD ?? 'Alanhon1_').trim();

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  session.loggedIn = true;
  session.username = username;
  await session.save();
  return res;
}
