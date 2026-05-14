import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/lib/i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export async function proxy(req: NextRequest) {
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

  // Admin page protection — all /manzura paths bypass i18n
  if (pathname.startsWith('/manzura')) {
    if (pathname !== '/manzura/login') {
      const res = NextResponse.next();
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (!session.loggedIn) {
        return NextResponse.redirect(new URL('/manzura/login', req.url));
      }
      return res;
    }
    // Login page: pass through directly without i18n redirect
    return NextResponse.next();
  }

  // i18n routing for all other pages
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    '/manzura/:path*',
    '/api/admin/:path*',
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
