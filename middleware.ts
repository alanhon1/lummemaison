import { NextRequest, NextResponse } from 'next/server';

// Site launch timestamp — update this to extend or move the window.
// Once Date.now() passes this value, all routes open automatically.
export const LAUNCH_AT = new Date('2026-06-08T16:30:00.000Z').getTime();

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: admin panel, API, the coming-soon page itself, and Next.js internals
  if (
    pathname.startsWith('/manzura') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/coming-soon') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/images')
  ) {
    return NextResponse.next();
  }

  if (Date.now() < LAUNCH_AT) {
    return NextResponse.redirect(new URL('/coming-soon', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
