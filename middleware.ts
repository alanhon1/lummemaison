import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';

// Edge-level guard for /manzura/* pages and /api/admin/* routes.
// Per-route handlers also check the session (defense-in-depth), but this
// middleware rejects unauthenticated requests before they reach handler code.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith('/manzura') && pathname !== '/manzura/login';
  const isAdminApi =
    pathname.startsWith('/api/admin') &&
    pathname !== '/api/admin/auth' &&
    pathname !== '/api/admin/logout';

  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.loggedIn) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/manzura/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/manzura/:path*', '/api/admin/:path*'],
};
