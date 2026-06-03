import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session';
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from '@/lib/i18n';
import { createServerClient } from '@supabase/ssr';
import { siteConfig } from '@/lib/site-config';

// ----- Geo-block -----
// Customer-facing pages are not available from siteConfig.restrictedCountries
// (currently ["KR"] — the wholesale brand operates out of Korea, and the
// Korean retail market is served separately). Vercel sets x-vercel-ip-country
// with the visitor's ISO-3166-1 alpha-2 country code on production.
//
// /manzura/* and /api/admin/* bypass — the admin (in Korea) needs those.
// Local dev has no header so this never blocks during development.
function maybeGeoBlock(req: NextRequest): NextResponse | null {
  const country = req.headers.get('x-vercel-ip-country');
  if (!country) return null;
  const restricted = (siteConfig.restrictedCountries as readonly string[]).map(c => c.toUpperCase());
  if (!restricted.includes(country.toUpperCase())) return null;

  // Intentionally indistinguishable from a generic "page not found". No
  // brand, no "blocked", no contact link — the visitor just sees what
  // looks like a misconfigured or non-existent URL. Browsers render their
  // own default chrome around the bare body.
  return new NextResponse(
    '<!doctype html><html><head><meta charset="utf-8"><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>',
    {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});

// Refresh the Supabase auth session cookies on every public request so server
// components observe a stable, non-expired session. Returns the response with
// any refreshed Set-Cookie headers attached.
async function withSupabaseSession(req: NextRequest, baseResponse: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return baseResponse;

  let response = baseResponse;
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touching getUser() triggers a refresh if the access token is near expiry.
  await supabase.auth.getUser();
  return response;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // All /api/ routes bypass i18n entirely
  if (pathname.startsWith('/api/')) {
    // Protect admin API (except auth and logout)
    if (
      pathname.startsWith('/api/admin/') &&
      !pathname.startsWith('/api/admin/auth') &&
      !pathname.startsWith('/api/admin/logout')
    ) {
      const res = NextResponse.next();
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      if (!session.loggedIn) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return res;
    }
    return NextResponse.next();
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

  // Geo-block customer-facing routes for visitors in restrictedCountries.
  // Reached only after the /manzura and /api/admin branches above have
  // already returned, so the admin paths are not affected.
  const blocked = maybeGeoBlock(req);
  if (blocked) return blocked;

  // Legacy /ko/* URLs → redirect to /en/* (Korean locale removed)
  if (pathname === '/ko' || pathname.startsWith('/ko/')) {
    return withSupabaseSession(
      req,
      NextResponse.redirect(new URL('/en' + (pathname.replace(/^\/ko/, '') || '/'), req.url), 308),
    );
  }

  // i18n routing + Supabase session refresh for all other pages
  const response = intlMiddleware(req);
  return withSupabaseSession(req, response);
}

export const config = {
  matcher: [
    '/manzura/:path*',
    '/api/admin/:path*',
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
