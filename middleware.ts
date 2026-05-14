import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API admin protection (except auth endpoint itself)
  if (pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth')) {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (!session.loggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return res;
  }

  // Admin page protection
  if (pathname.startsWith('/manzura') && pathname !== '/manzura/login') {
    const res = NextResponse.next();
    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    if (!session.loggedIn) {
      return NextResponse.redirect(new URL('/manzura/login', req.url));
    }
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/manzura/:path*',
    '/api/admin/:path*',
  ],
};
