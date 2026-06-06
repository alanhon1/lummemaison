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

  // Keep the visitor on the original lumeemaison.com URL but return an
  // empty 502 Bad Gateway. Chrome / Safari / Firefox render their own
  // native "This page isn't working — HTTP ERROR 502" chrome around an
  // empty body, with the address bar preserved. From the visitor's side
  // it is indistinguishable from a real upstream failure — which is
  // exactly what a school-firewall-style network interception causes.
  //
  // (Earlier attempts: a redirect to a .invalid host leaked the trick in
  // the address bar; a Content-Encoding: gzip mismatch was stripped by
  // the Next.js / Vercel response pipeline. The bare-status route below
  // is the one Next.js doesn't second-guess.)
  return new NextResponse(null, {
    status: 502,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
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

// Site launch timestamp — once Date.now() passes this the gate opens automatically.
export const LAUNCH_AT = new Date('2026-06-07T00:00:00.000Z').getTime();

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Coming-soon gate: redirect all public routes until launch time.
  // Admin, API, the coming-soon page itself, and static assets bypass.
  if (
    Date.now() < LAUNCH_AT &&
    !pathname.startsWith('/manzura') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/coming-soon') &&
    !pathname.startsWith('/_next') &&
    pathname !== '/favicon.ico'
  ) {
    return NextResponse.redirect(new URL('/coming-soon', req.url));
  }

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

  // English now lives at the root (localePrefix: 'as-needed'). Permanently
  // redirect legacy /en/* URLs (old bookmarks, external links, search index)
  // to the unprefixed path.
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname.replace(/^\/en/, '') || '/';
    return withSupabaseSession(
      req,
      NextResponse.redirect(new URL(rest + req.nextUrl.search, req.url), 301),
    );
  }

  // Legacy /ko/* URLs → redirect to the (English) root (Korean locale removed)
  if (pathname === '/ko' || pathname.startsWith('/ko/')) {
    const rest = pathname.replace(/^\/ko/, '') || '/';
    return withSupabaseSession(
      req,
      NextResponse.redirect(new URL(rest + req.nextUrl.search, req.url), 308),
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
    // Exclude /auth (signup confirmation callback) from the locale-prefix
    // rewrite — the route handler at /auth/confirm needs the exact path.
    '/((?!_next|_vercel|api|auth|.*\\..*).*)',
  ],
};
